/**
 * WsMetrics
 *
 * Simple in-process counters for WebSocket server observability.
 * In production these would be forwarded to Prometheus / CloudWatch; here they
 * are plain mutable numbers so tests can assert on them without external deps.
 */

export interface WsMetricsSnapshot {
  activeConnections: number;
  totalConnections: number;
  messagesReceived: number;
  subscribeEvents: number;
  unsubscribeEvents: number;
  rateLimitExceededDisconnects: number;
  idleTimeoutDisconnects: number;
}

export class WsMetrics {
  activeConnections = 0;
  totalConnections = 0;
  messagesReceived = 0;
  subscribeEvents = 0;
  unsubscribeEvents = 0;
  /** Connections forcibly closed because the client exceeded the rate limit. */
  rateLimitExceededDisconnects = 0;
  /** Connections forcibly closed because the client was idle too long. */
  idleTimeoutDisconnects = 0;

  snapshot(): WsMetricsSnapshot {
    return {
      activeConnections: this.activeConnections,
      totalConnections: this.totalConnections,
      messagesReceived: this.messagesReceived,
      subscribeEvents: this.subscribeEvents,
      unsubscribeEvents: this.unsubscribeEvents,
      rateLimitExceededDisconnects: this.rateLimitExceededDisconnects,
      idleTimeoutDisconnects: this.idleTimeoutDisconnects,
    };
  }

  reset(): void {
    this.activeConnections = 0;
    this.totalConnections = 0;
    this.messagesReceived = 0;
    this.subscribeEvents = 0;
    this.unsubscribeEvents = 0;
    this.rateLimitExceededDisconnects = 0;
    this.idleTimeoutDisconnects = 0;
  }
}

/** Module-level singleton so both WS servers share the same metrics object. */
export const globalMetrics = new WsMetrics();
