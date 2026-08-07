import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiHandler, NotFoundError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";

export const GET = apiHandler(async (_req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireTenant();
  const call = await db.call.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    include: {
      customer: {
        include: {
          technologies: true,
          integrations: true,
          issues: { orderBy: { createdAt: "desc" } },
          actionItems: { where: { status: "open" } },
          contacts: true,
          documents: { where: { deletedAt: null, status: "READY" }, select: { id: true, title: true, documentType: true }, take: 10 },
          calls: { where: { id: { not: params.id }, status: "ENDED" }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, callType: true, createdAt: true, resolution: { select: { finalIssueSummary: true, finalResolution: true, customerConfirmedFix: true } } } },
        },
      },
      participants: true,
      segments: { where: { isInterim: false }, orderBy: { spokenAt: "asc" } },
      recommendations: { orderBy: { createdAt: "asc" }, include: { sources: true, feedback: { select: { rating: true } } } },
      resolution: true,
      review: true,
    },
  });
  if (!call) throw new NotFoundError("Call not found.");
  return NextResponse.json({ call });
});
