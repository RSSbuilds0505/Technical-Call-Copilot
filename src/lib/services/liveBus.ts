/**
 * In-process pub/sub for live call updates (transcript segments + recommendations),
 * consumed by the SSE endpoint. Single-node MVP scope; swap for Redis pub/sub when
 * running multiple app instances.
 */
export interface LiveEvent {
  type: "segment" | "recommendation" | "call_status" | "error";
  callId: string;
  data: unknown;
}

type Listener = (event: LiveEvent) => void;

const globalBus = globalThis as unknown as { tccBus?: Map<string, Set<Listener>> };
if (!globalBus.tccBus) globalBus.tccBus = new Map();

export function subscribe(callId: string, listener: Listener): () => void {
  const bus = globalBus.tccBus!;
  if (!bus.has(callId)) bus.set(callId, new Set());
  bus.get(callId)!.add(listener);
  return () => {
    bus.get(callId)?.delete(listener);
    if (bus.get(callId)?.size === 0) bus.delete(callId);
  };
}

export function publish(event: LiveEvent): void {
  globalBus.tccBus!.get(event.callId)?.forEach((listener) => {
    try { listener(event); } catch (err) { console.error("Live bus listener error:", err); }
  });
}
