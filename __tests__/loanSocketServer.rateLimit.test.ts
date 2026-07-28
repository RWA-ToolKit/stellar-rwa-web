/**
 * loanSocketServer.rateLimit.test.ts
 *
 * Tests for the per-connection sliding-window rate limit on
 * subscribe / unsubscribe WS messages.
 *
 * Scenario: a client sends more subscribe events than the configured limit
 * within the sliding window.  The server must:
 *   1. Close the connection with code 4029 ("Too Many Requests")
 *   2. Release the connection's state (ConnectionQueue released)
 *   3. Increment metrics.rateLimitExceededDisconnects
 */

import { createServer, Server as HttpServer } from "http";
import { WebSocket } from "ws";
import { attachLoanSocketServer, WS_CLOSE_RATE_LIMIT_EXCEEDED } from "../server/loanSocketServer";
import { WsMetrics } from "../server/WsMetrics";

// Helper: wait for a condition to become true, retrying every `interval` ms.
function waitFor(
  condition: () => boolean,
  timeoutMs = 3_000,
  interval = 20
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const id = setInterval(() => {
      if (condition()) {
        clearInterval(id);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(id);
        reject(new Error("waitFor timed out"));
      }
    }, interval);
  });
}

// Helper: open a WebSocket client that connects to the test server.
function openClient(port: number): WebSocket {
  return new WebSocket(`ws://127.0.0.1:${port}/ws/loans`);
}

describe("loanSocketServer — rate limiting", () => {
  let httpServer: HttpServer;
  let metrics: WsMetrics;
  let port: number;

  beforeEach(
    () =>
      new Promise<void>((resolve) => {
        metrics = new WsMetrics();
        httpServer = createServer();
        attachLoanSocketServer(httpServer, {
          rateLimit: 5,          // tight limit so tests run fast
          rateLimitWindowMs: 1_000,
          pingIntervalMs: 60_000, // effectively disabled for rate-limit tests
          pongTimeoutMs: 5_000,
          metrics,
          path: "/ws/loans",
        });
        httpServer.listen(0, "127.0.0.1", () => {
          const addr = httpServer.address() as { port: number };
          port = addr.port;
          resolve();
        });
      }),
    5_000
  );

  afterEach(
    () =>
      new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      }),
    5_000
  );

  // ── Test 1: well-behaved client stays connected ──────────────────────────

  it("allows a client that sends fewer messages than the limit", async () => {
    const client = openClient(port);
    await waitFor(() => client.readyState === WebSocket.OPEN);

    // Send 5 subscribe messages — exactly at the limit.
    for (let i = 0; i < 5; i++) {
      client.send(JSON.stringify({ type: "subscribe", loanId: `loan-${i}` }));
    }

    // Wait briefly then assert the connection is still open.
    await new Promise((r) => setTimeout(r, 200));
    expect(client.readyState).toBe(WebSocket.OPEN);
    expect(metrics.rateLimitExceededDisconnects).toBe(0);

    client.close();
    await waitFor(() => client.readyState === WebSocket.CLOSED);
  }, 10_000);

  // ── Test 2: flood disconnects the client with code 4029 ──────────────────

  it("disconnects a flooding client with close code 4029", async () => {
    const client = openClient(port);
    await waitFor(() => client.readyState === WebSocket.OPEN);

    let closeCode: number | undefined;
    client.on("close", (code) => {
      closeCode = code;
    });

    // Flood: send 20 subscribe messages — well above the limit of 5.
    for (let i = 0; i < 20; i++) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "subscribe", loanId: `loan-${i}` }));
      }
    }

    // The server should close the connection.
    await waitFor(() => client.readyState === WebSocket.CLOSED, 5_000);

    expect(client.readyState).toBe(WebSocket.CLOSED);
    expect(closeCode).toBe(WS_CLOSE_RATE_LIMIT_EXCEEDED); // 4029
  }, 10_000);

  // ── Test 3: metrics counter incremented ───────────────────────────────────

  it("increments rateLimitExceededDisconnects in metrics", async () => {
    const client = openClient(port);
    await waitFor(() => client.readyState === WebSocket.OPEN);

    // Flood two separate quick clients.
    const floodAndWait = async (c: WebSocket) => {
      for (let i = 0; i < 20; i++) {
        if (c.readyState === WebSocket.OPEN) {
          c.send(JSON.stringify({ type: "subscribe", loanId: `loan-${i}` }));
        }
      }
      await waitFor(() => c.readyState === WebSocket.CLOSED, 5_000);
    };

    const client2 = openClient(port);
    await waitFor(() => client2.readyState === WebSocket.OPEN);

    await Promise.all([floodAndWait(client), floodAndWait(client2)]);

    expect(metrics.rateLimitExceededDisconnects).toBeGreaterThanOrEqual(2);
  }, 15_000);

  // ── Test 4: unsubscribe messages are also rate-limited ────────────────────

  it("rate-limits unsubscribe churn the same as subscribe", async () => {
    const client = openClient(port);
    await waitFor(() => client.readyState === WebSocket.OPEN);

    let closeCode: number | undefined;
    client.on("close", (code) => { closeCode = code; });

    // First subscribe to a loan so unsubscribe has something to remove.
    client.send(JSON.stringify({ type: "subscribe", loanId: "loan-0" }));

    // Now spam unsubscribe.
    for (let i = 0; i < 20; i++) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "unsubscribe", loanId: "loan-0" }));
      }
    }

    await waitFor(() => client.readyState === WebSocket.CLOSED, 5_000);
    expect(closeCode).toBe(WS_CLOSE_RATE_LIMIT_EXCEEDED);
  }, 10_000);

  // ── Test 5: ConnectionQueue is released on disconnect ─────────────────────

  it("server accepts new connections after previous one was rate-limited", async () => {
    // Flood and disconnect one client.
    const bad = openClient(port);
    await waitFor(() => bad.readyState === WebSocket.OPEN);
    for (let i = 0; i < 20; i++) {
      if (bad.readyState === WebSocket.OPEN) {
        bad.send(JSON.stringify({ type: "subscribe", loanId: `loan-${i}` }));
      }
    }
    await waitFor(() => bad.readyState === WebSocket.CLOSED, 5_000);

    // A new well-behaved client should connect and work fine.
    const good = openClient(port);
    await waitFor(() => good.readyState === WebSocket.OPEN);

    const received: string[] = [];
    good.on("message", (d) => received.push(d.toString()));
    good.send(JSON.stringify({ type: "subscribe", loanId: "loan-A" }));

    await waitFor(() => received.length >= 1, 3_000);
    expect(received[0]).toContain("subscribed");

    good.close();
    await waitFor(() => good.readyState === WebSocket.CLOSED);
  }, 15_000);
});
