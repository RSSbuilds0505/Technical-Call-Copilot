import type { QueueDriver } from "./types";
import { InlineQueueDriver } from "./inline";

const globalForQueue = globalThis as unknown as { tccQueue?: QueueDriver };

export function getQueue(): QueueDriver {
  if (!globalForQueue.tccQueue) globalForQueue.tccQueue = new InlineQueueDriver();
  return globalForQueue.tccQueue;
}
