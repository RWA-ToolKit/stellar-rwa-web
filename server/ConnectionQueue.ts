/**
 * ConnectionQueue
 *
 * Tracks per-connection state: the set of loan IDs a client has subscribed to
 * and a bounded outbound message queue that accumulates updates while they are
 * being flushed.  Releasing a ConnectionQueue clears all state so memory is
 * reclaimed immediately when a socket closes.
 */

export interface QueuedMessage {
  loanId: string;
  payload: unknown;
  enqueuedAt: number;
}

export class ConnectionQueue {
  /** Loan IDs this connection is currently subscribed to. */
  readonly subscriptions = new Set<string>();

  /** Pending outbound messages not yet sent to the client. */
  private readonly queue: QueuedMessage[] = [];

  private released = false;

  subscribe(loanId: string): void {
    this.assertAlive();
    this.subscriptions.add(loanId);
  }

  unsubscribe(loanId: string): void {
    this.assertAlive();
    this.subscriptions.delete(loanId);
  }

  enqueue(loanId: string, payload: unknown): void {
    this.assertAlive();
    if (!this.subscriptions.has(loanId)) return;
    this.queue.push({ loanId, payload, enqueuedAt: Date.now() });
  }

  /** Drain and return all pending messages. */
  drain(): QueuedMessage[] {
    const messages = this.queue.splice(0);
    return messages;
  }

  /** Release all state.  After this the queue must not be used. */
  release(): void {
    this.released = true;
    this.subscriptions.clear();
    this.queue.length = 0;
  }

  get isReleased(): boolean {
    return this.released;
  }

  private assertAlive(): void {
    if (this.released) {
      throw new Error("ConnectionQueue has already been released");
    }
  }
}
