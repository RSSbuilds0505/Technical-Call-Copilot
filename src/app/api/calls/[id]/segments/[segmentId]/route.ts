import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, NotFoundError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";

const bodySchema = z.object({
  content: z.string().min(1).max(8000).optional(),
  isImportant: z.boolean().optional(),
});

export const PATCH = apiHandler(async (req: Request, { params }: { params: { id: string; segmentId: string } }) => {
  const ctx = await requireTenant("SPECIALIST");
  const body = bodySchema.parse(await req.json());
  const segment = await db.transcriptSegment.findFirst({
    where: { id: params.segmentId, callId: params.id, organizationId: ctx.organizationId },
  });
  if (!segment) throw new NotFoundError("Transcript segment not found.");
  const updated = await db.transcriptSegment.update({
    where: { id: segment.id },
    data: { ...body, ...(body.content ? { editedById: ctx.userId } : {}) },
  });
  return NextResponse.json({ segment: updated });
});

export const DELETE = apiHandler(async (_req: Request, { params }: { params: { id: string; segmentId: string } }) => {
  const ctx = await requireTenant("SPECIALIST");
  const segment = await db.transcriptSegment.findFirst({
    where: { id: params.segmentId, callId: params.id, organizationId: ctx.organizationId, isInterim: true },
  });
  if (!segment) throw new NotFoundError("Interim segment not found.");
  await db.transcriptSegment.delete({ where: { id: segment.id } });
  return NextResponse.json({ ok: true });
});
