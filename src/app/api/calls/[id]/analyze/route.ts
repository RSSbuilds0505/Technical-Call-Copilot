import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, AppError, NotFoundError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { generateRecommendation, serializeRecommendation } from "@/lib/services/recommendations";

const bodySchema = z.object({
  mode: z.enum(["last_30s", "selection", "custom"]).default("last_30s"),
  selectionText: z.string().max(8000).optional(),
  prompt: z.string().max(2000).optional(),
});

/** Manual copilot actions: analyze last 30s, analyze a selection, or run a quick-action / custom prompt. */
export const POST = apiHandler(async (req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireTenant("SPECIALIST");
  const body = bodySchema.parse(await req.json());
  const call = await db.call.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!call) throw new NotFoundError("Call not found.");

  let triggerText = body.selectionText?.trim() ?? "";
  if (body.mode === "last_30s" || (!triggerText && body.mode !== "custom")) {
    const cutoff = new Date(Date.now() - 30_000);
    const recent = await db.transcriptSegment.findMany({
      where: { callId: call.id, isInterim: false, spokenAt: { gte: cutoff } },
      orderBy: { spokenAt: "asc" },
    });
    const source = recent.length > 0 ? recent : await db.transcriptSegment.findMany({
      where: { callId: call.id, isInterim: false }, orderBy: { spokenAt: "desc" }, take: 5,
    }).then((s) => s.reverse());
    triggerText = source.map((s) => `${s.speakerName}: ${s.content}`).join("\n");
  }
  if (!triggerText && !body.prompt) {
    throw new AppError("There's no transcript to analyze yet. Add a transcript message first.", 422, "empty");
  }

  const recommendation = await generateRecommendation({
    ctx,
    callId: call.id,
    triggerText: triggerText || (body.prompt ?? ""),
    eventType: "technical_question",
    manualPrompt: body.prompt ?? null,
  });
  return NextResponse.json({ recommendation: serializeRecommendation(recommendation) }, { status: 201 });
});
