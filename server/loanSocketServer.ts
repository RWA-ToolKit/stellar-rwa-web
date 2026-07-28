/**
 * loanSocketServer.ts
 *
 * Attaches a WebSocket server to an existing HTTP(S) server and handles
 * real-time loan-update subscriptions.
 *
 * Security & reliability features
 * ────────────────────────────────
 * 1. Per-connection sliding-window rate limit on subscribe / unsubscribe
 *    messages.  A client that churns more than RATE_LIMIT messages within the
 *    window is disconnected with close code 4029 ("Too Many Requests").
 *
 * 2. Application-level ping/pong heartbeat.  Every PING_INTERVAL ms the server
 *    sends a ping frame.  If no pong arrives within PONG_TIMEOUT ms the
 *    connection is considered half-open (e.g. a dead mobile NAT entry) and is
 *    torn down, its ConnectionQueue and subscription state released.  Forcibly
 *    closed idle connections are counted in WsMetrics.idleTimeoutDisconnects.
 */

import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket, RawData } from "ws";

import { ConnectionQueue } from "./ConnectionQueue";
import { SlidingWindowRateLimiter } from "./SlidingWindowRateLimiter";
import { globalMetrics, WsMetrics } from "./WsMetrics";

// ─── Configuration ────────────────────────────────────────────────────────────

export interface LoanSocketServerOptions {
  /**
   * Maximum subscribe/unsubscribe messages allowed per connection within
   * `rateLimitWindowMs`.  Default: 20
   */
  rateLimit?: number;
  /**
   * Sliding-window duration for rate limiting in ms.  Default: 1 000 (1 s)
   */
  rateLimitWindowMs?: number;
  /**
   * How often (ms) the server sends a ping frame to each client.
   * Default: 30 000 (30 s)
   */
  pingIntervalMs?: number;
  /**
   * How long (ms) the server waits for a pong reply before terminating the
   * connection.  Default: 10 000 (10 s)
   */
  pongTimeoutMs?: number;
  /** Injectable metrics instance; defaults to the global singleton. */
  metrics?: WsMetrics;
  /** WebSocket server path.  Default: "/ws/loans" */
  path?: string;
}

// WS close codes used by this server.
export const WS_CLOSE_NORMAL = 1000;
export const WS_CLOSE_RATE_LIMIT_EXCEEDED = 4029; // 4xxx = application-defined
export const WS_CLOSE_IDLE_TIMEOUT = 4408;         // 408 Request Timeout analogy

// ─── Per-connection state ─────────────────────────────────────────────────────

interface ConnectionState {
  queue: ConnectionQueue;
  limiter: SlidingWindowRateLimiter;
  pingTimer: ReturnType<typeof setInterval> | null;
  pongTimer: ReturnType<typeof setTimeout> | null;
  /** True once a pong has been received for the last outstanding ping. */
  pongReceived: boolean;
}

// ─── Message shapes ───────────────────────────────────────────────────────────

interface SubscribeMessage {
  type: "subscribe";
  loanId: string;
}

interface UnsubscribeMessage {
  type: "unsubscribe";
  loanId: string;
}

type InboundMessage = SubscribeMessage | UnsubscribeMessage;

function isInboundMessage(v: unknown): v is InboundMessage {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    (m.type === "subscribe" || m.type === "unsubscribe") &&
    typeof m.loanId === "string" &&
    m.loanId.length > 0
  );
}

// ─── attachLoanSocketServer ───────────────────────────────────────────────────

/**
 * Attaches the loan WebSocket server to `httpServer`.
 *
 * @returns The underlying `WebSocketServer` instance so the caller can close
 *          it during graceful shutdown.
 */
export function attachLoanSocketServer(
  httpServer: HttpServer,
  options: LoanSocketServerOptions = {}
): WebSocketServer {
  const {
    rateLimit = 20,
    rateLimitWindowMs = 1_000,
    pingIntervalMs = 30_000,
    pongTimeoutMs = 10_000,
    metrics = globalMetrics,
    path = "/ws/loans",
  } = options;

  const wss = new WebSocketServer({ server: httpServer, path });

  wss.on("connection", (ws: WebSocket) => {
    metrics.totalConnections += 1;
    metrics.activeConnections += 1;

    const state: ConnectionState = {
      queue: new ConnectionQueue(),
      limiter: new SlidingWindowRateLimiter({ limit: rateLimit, windowMs: rateLimitWindowMs }),
      pingTimer: null,
      pongTimer: null,
      pongReceived: true,
    };

    // ── Heartbeat ──────────────────────────────────────────────────────────
    function startHeartbeat(): void {
      state.pingTimer = setInterval(() => {
        if (!state.pongReceived) {
          // Previous ping went unanswered — connection is half-open.
          teardown(ws, state, WS_CLOSE_IDLE_TIMEOUT, "idle timeout");
          metrics.idleTimeoutDisconnects += 1;
          return;
        }
        state.pongReceived = false;

        // Schedule a hard timeout in case the pong frame never arrives.
        state.pongTimer = setTimeout(() => {
          if (!state.pongReceived) {
            teardown(ws, state, WS_CLOSE_IDLE_TIMEOUT, "pong timeout");
            metrics.idleTimeoutDisconnects += 1;
          }
        }, pongTimeoutMs);

        ws.ping();
      }, pingIntervalMs);
    }

    ws.on("pong", () => {
      state.pongReceived = true;
      if (state.pongTimer !== null) {
        clearTimeout(state.pongTimer);
        state.pongTimer = null;
      }
    });

    startHeartbeat();

    // ── Inbound messages ───────────────────────────────────────────────────
    ws.on("message", (raw: RawData) => {
      metrics.messagesReceived += 1;

      // Rate-limit check — applies to every inbound message.
      if (!state.limiter.hit()) {
        teardown(ws, state, WS_CLOSE_RATE_LIMIT_EXCEEDED, "rate limit exceeded");
        metrics.rateLimitExceededDisconnects += 1;
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ error: "invalid JSON" }));
        return;
      }

      if (!isInboundMessage(parsed)) {
        ws.send(JSON.stringify({ error: "unknown message type" }));
        return;
      }

      if (parsed.type === "subscribe") {
        metrics.subscribeEvents += 1;
        state.queue.subscribe(parsed.loanId);
        ws.send(JSON.stringify({ type: "subscribed", loanId: parsed.loanId }));
      } else {
        metrics.unsubscribeEvents += 1;
        state.queue.unsubscribe(parsed.loanId);
        ws.send(JSON.stringify({ type: "unsubscribed", loanId: parsed.loanId }));
      }
    });

    // ── Close / Error ──────────────────────────────────────────────────────
    ws.on("close", () => {
      cleanupTimers(state);
      if (!state.queue.isReleased) {
        state.queue.release();
      }
      metrics.activeConnections -= 1;
    });

    ws.on("error", (err: Error) => {
      console.error("[loanSocketServer] ws error:", err.message);
      teardown(ws, state, WS_CLOSE_NORMAL, "error");
    });
  });

  return wss;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanupTimers(state: ConnectionState): void {
  if (state.pingTimer !== null) {
    clearInterval(state.pingTimer);
    state.pingTimer = null;
  }
  if (state.pongTimer !== null) {
    clearTimeout(state.pongTimer);
    state.pongTimer = null;
  }
}

function teardown(
  ws: WebSocket,
  state: ConnectionState,
  code: number,
  reason: string
): void {
  cleanupTimers(state);
  if (!state.queue.isReleased) {
    state.queue.release();
  }
  // ws.readyState guard prevents double-close errors.
  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
    ws.close(code, reason);
  }
}
