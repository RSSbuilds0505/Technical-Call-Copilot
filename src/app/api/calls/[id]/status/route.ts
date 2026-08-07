import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, AppError, NotFoundError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { publish } from "@/lib/services/liveBus";

const bodySchema = z.object({
  status: z.enum(["LIVE", "PAUSED", "ENDED"]),
  /** Consent may be confirmed at go-live time (e.g. for drafts created without it). Only `true` is accepted; consent cannot be revoked here. */
  consentConfirmed: z.literal(true).optional(),
});

export const POST = apiHandler(async (req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireTenant("SPECIALIST");
  const { status, consentConfirmed } = bodySchema.parse(await req.json());
  const call = await db.call.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!call) throw new NotFoundError("Call not found.");
  const consent = call.consentConfirmed || consentConfirmed === true;
  if (status === "LIVE" && !consent) {
    throw new AppError("Participant consent must be confirmed before transcription starts.", 403, "consent_required");
  }
  const updated = await db.call.update({
    where: { id: call.id },
    data: {
      status,
      consentConfirmed: consent,
      startedAt: status === "LIVE" && !call.startedAt ? new Date() : call.startedAt,
      endedAt: status === "ENDED" ? new Date() : call.endedAt,
    },
  });
  publish({ type: "call_status", callId: call.id, data: { status: updated.status } });
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: status === "ENDED" ? "call.end" : "call.status", resourceType: "call", resourceId: call.id, metadata: { status } });
  return NextResponse.json({ call: updated });
});
