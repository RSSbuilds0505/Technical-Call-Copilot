import type { JobHandler, QueueDriver } from "./types";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

export class InlineQueueDriver implements QueueDriver {
  readonly name = "inline";
  private handlers = new Map<string, JobHandler<unknown>>();

  register<T>(jobName: string, handler: JobHandler<T>): void {
    this.handlers.set(jobName, handler as JobHandler<unknown>);
  }

  async enqueue<T>(jobName: string, payload: T): Promise<void> {
    const handler = this.handlers.get(jobName);
    if (!handler) throw new Error(`No handler registered for job "${jobName}".`);
    // Fire-and-forget with retry; failures are logged and, for ingestion jobs,
    // reflected on the document record so users can reprocess.
    void this.run(jobName, handler, payload, 1);
  }

  private async run(jobName: string, handler: JobHandler<unknown>, payload: unknown, attempt: number): Promise<void> {
    try {
      await handler(payload);
    } catch (err) {
      console.error(`Job "${jobName}" failed (attempt ${attempt}):`, err);
      if (attempt < MAX_ATTEMPTS) {
        setTimeout(() => void this.run(jobName, handler, payload, attempt + 1), RETRY_DELAY_MS * attempt);
      }
    }
  }
}
