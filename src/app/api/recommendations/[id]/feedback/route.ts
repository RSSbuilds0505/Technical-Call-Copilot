import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, NotFoundError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";

const bodySchema = z.object({
  rating: z.enum(["helpful", "partially_helpful", "incorrect", "dismissed"]),
  usedOnCall: z.boolean().default(false),
  editedBeforeUse: z.boolean().default(false),
  issueResolved: z.boolean().default(false),
  issuePartiallyResolved: z.boolean().default(false),
  incorrectDiagnosis: z.boolean().default(false),
  escalated: z.boolean().default(false),
  finalRootCause: z.string().max(2000).optional().nullable(),
  finalResolution: z.string().max(4000).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export const POST = apiHandler(async (req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireTenant("SPECIALIST");
  const body = bodySchema.parse(await req.json());
  const rec = await db.recommendation.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!rec) throw new NotFoundError("Recommendation not found.");
  const feedback = await db.recommendationFeedback.create({
    data: {
      ...body,
      recommendationId: rec.id,
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      customerId: rec.customerId,
      callId: rec.callId,
    },
  });
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "feedback.submit", resourceType: "recommendation", resourceId: rec.id, metadata: { rating: body.rating } });
  return NextResponse.json({ feedback }, { status: 201 });
});
