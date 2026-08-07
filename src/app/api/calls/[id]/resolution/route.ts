import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, NotFoundError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { publishResolvedCase } from "@/lib/services/postcall";

const bodySchema = z.object({
  finalIssueSummary: z.string().max(2000).optional().nullable(),
  confirmedRootCause: z.string().max(2000).optional().nullable(),
  finalResolution: z.string().max(4000).optional().nullable(),
  customerConfirmedFix: z.boolean().default(false),
  followUpRequired: z.boolean().default(false),
  engineeringEscalation: z.boolean().default(false),
  docsToUpdate: z.string().max(2000).optional().nullable(),
});

export const POST = apiHandler(async (req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireTenant("SPECIALIST");
  const body = bodySchema.parse(await req.json());
  const call = await db.call.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!call) throw new NotFoundError("Call not found.");
  const resolution = await db.resolution.upsert({
    where: { callId: call.id },
    update: body,
    create: { ...body, callId: call.id, organizationId: ctx.organizationId },
  });
  // Confirmed resolutions become retrieval material for future calls.
  if (resolution.customerConfirmedFix && resolution.finalResolution && resolution.confirmedRootCause) {
    void publishResolvedCase(ctx, call.id).catch((err) => console.error("Resolved-case publish failed:", err));
  }
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "call.resolution", resourceType: "call", resourceId: call.id });
  return NextResponse.json({ resolution });
});
