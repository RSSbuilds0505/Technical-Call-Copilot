import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { subscribe } from "@/lib/services/liveBus";

export const dynamic = "force-dynamic";

/** Server-Sent Events stream for live transcript + recommendation updates. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let ctx;
  try {
    ctx = await requireTenant();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const call = await db.call.findFirst({ where: { id: params.id, organizationId: ctx.organizationId }, select: { id: true } });
  if (!call) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch { /* stream closed */ }
      };
      cleanup = subscribe(call.id, send);
      heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { /* closed */ }
      }, 15000);
      send({ type: "connected", callId: call.id, data: {} });
    },
    cancel() {
      cleanup?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
