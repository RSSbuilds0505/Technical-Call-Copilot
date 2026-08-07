export type JobHandler<T> = (payload: T) => Promise<void>;

/**
 * Background-job abstraction used for document ingestion, post-call processing,
 * and connector sync. The inline driver runs jobs in-process with retry; a
 * Redis/BullMQ driver can be added behind the same interface for horizontal scale.
 */
export interface QueueDriver {
  readonly name: string;
  register<T>(jobName: string, handler: JobHandler<T>): void;
  enqueue<T>(jobName: string, payload: T): Promise<void>;
}
