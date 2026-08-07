import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, AppError, NotFoundError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { publish } from "@/lib/services/liveBus";
import { detectEvent, isDuplicateEvent } from "@/lib/services/eventDetection";
import { generateRecommendation } from "@/lib/services/recommendations";

const bodySchema = z.object({
  speakerName: z.string().min(1).max(120),
  speakerRole: z.enum(["customer", "specialist", "internal", "other"]).default("customer"),
  content: z.string().min(1).max(8000),
  isInterim: z.boolean().default(false),
});

/**
 * Simulated-transcript ingestion: each POST is a completed (or interim) speaker turn.
 * Final turns run event detection; qualifying events trigger recommendation generation
 * in the background, streamed to the workspace over SSE.
 */
export const POST = apiHandler(async (req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireTenant("SPECIALIST");
  const body = bodySchema.parse(await req.json());
  const call = await db.call.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!call) throw new NotFoundError("Call not found.");
  if (call.status !== "LIVE") throw new AppError("Start the session before adding transcript.", 409, "not_live");

  const segment = await db.transcriptSegment.create({
    data: {
      callId: call.id,
      organizationId: ctx.organizationId,
      speakerName: body.speakerName,
      speakerRole: body.speakerRole,
      content: body.content,
      isInterim: body.isInterim,
    },
  });
  publish({ type: "segment", callId: call.id, data: { id: segment.id, speakerName: segment.speakerName, speakerRole: segment.speakerRole, content: segment.content, isInterim: segment.isInterim, isImportant: segment.isImportant, spokenAt: segment.spokenAt.toISOString() } });

  let detection = null as ReturnType<typeof detectEvent> | null;
  if (!body.isInterim) {
    detection = detectEvent(body.content, body.speakerRole);
    if (detection.shouldRecommend) {
      const recent = await db.detectedEvent.findMany({
        where: { callId: call.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { fingerprint: true, createdAt: true },
      });
      if (!isDuplicateEvent(detection.fingerprint, recent)) {
        const event = await db.detectedEvent.create({
          data: {
            callId: call.id,
            organizationId: ctx.organizationId,
            segmentId: segment.id,
            eventType: detection.eventType,
            summary: detection.summary,
            triggerText: body.content.slice(0, 500),
            fingerprint: detection.fingerprint,
          },
        });
        // Generate asynchronously so transcript entry stays fast; result arrives via SSE.
        void generateRecommendation({ ctx, callId: call.id, triggerText: body.content, eventType: detection.eventType, eventId: event.id })
          .catch((err) => console.error("Recommendation generation failed:", err));
      }
    }
  }
  return NextResponse.json({ segment, detection: detection ? { eventType: detection.eventType, triggered: detection.shouldRecommend } : null }, { status: 201 });
});
