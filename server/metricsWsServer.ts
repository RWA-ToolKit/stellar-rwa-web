/**
 * metricsWsServer.ts
 *
 * Attaches a WebSocket server that streams platform metrics snapshots to
 * connected dashboards.
 *
 * Security & reliability features
 * ────────────────────────────────
 * 1. Application-level ping/pong heartbeat identical to loanSocketServer:
 *    half-open connections are detected and torn down within
 *    pingIntervalMs + pongTimeoutMs.
 *
 * 2. Idle connections are counted in WsMetrics.idleTimeoutDisconnects.
 *
 * Note: the metrics endpoint is typically consumed by internal dashboards so
 * the rate-limit policy is intentionally more lenient (no subscribe churn).
 * A basic per-connection message rate limit is still applied to prevent abuse.
 */

import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket, RawData } from "ws";

import { ConnectionQueue } from "./ConnectionQueue";
import { SlidingWindowRateLimiter } from "./SlidingWindowRateLimiter";
import { globalMetrics, WsMetrics } from "./WsMetrics";

// ─── Configuration ────────────────────────────────────────────────────────────

export interface MetricsWsServerOptions {
  /** Max inbound messages per connection within `rateLimitWindowMs`. Default: 30 */
  rateLimit?: number;
  /** Sliding-window duration in ms. Default: 1 000 */
  rateLimitWindowMs?: number;
  /** Ping interval in ms. Default: 30 000 */
  pingIntervalMs?: number;
  /** Pong timeout in ms. Default: 10 000 */
  pongTimeoutMs?: number;
  /** Injectable metrics instance; defaults to the global singleton. */
  metrics?: WsMetrics;
  /** WebSocket server path. Default: "/ws/metrics" */
  path?: string;
}

export const WS_CLOSE_NORMAL = 1000;
export const WS_CLOSE_RATE_LIMIT_EXCEEDED = 4029;
export const WS_CLOSE_IDLE_TIMEOUT = 4408;

// ─── Per-connection state ─────────────────────────────────────────────────────

interface ConnectionState {
  queue: ConnectionQueue;
  limiter: SlidingWindowRateLimiter;
  pingTimer: ReturnType<typeof setInterval> | null;
  pongTimer: ReturnType<typeof setTimeout> | null;
  pongReceived: boolean;
}

// ─── attachMetricsWsServer ────────────────────────────────────────────────────

/**
 * Attaches the metrics WebSocket server to `httpServer`.
 *
 * @returns The underlying `WebSocketServer` so the caller can close it during
 *          graceful shutdown.
 */
export function attachMetricsWsServer(
  httpServer: HttpServer,
  options: MetricsWsServerOptions = {}
): WebSocketServer {
  const {
    rateLimit = 30,
    rateLimitWindowMs = 1_000,
    pingIntervalMs = 30_000,
    pongTimeoutMs = 10_000,
    metrics = globalMetrics,
    path = "/ws/metrics",
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
          teardown(ws, state, WS_CLOSE_IDLE_TIMEOUT, "idle timeout");
          metrics.idleTimeoutDisconnects += 1;
          return;
        }
        state.pongReceived = false;

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

      // The metrics socket accepts a "get_snapshot" request.
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        (parsed as Record<string, unknown>).type === "get_snapshot"
      ) {
        ws.send(JSON.stringify({ type: "snapshot", data: metrics.snapshot() }));
      } else {
        ws.send(JSON.stringify({ error: "unknown message type" }));
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
      console.error("[metricsWsServer] ws error:", err.message);
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
  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
    ws.close(code, reason);
  }
}
