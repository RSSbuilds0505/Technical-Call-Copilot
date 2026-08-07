import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { ReviewClient } from "@/components/call/ReviewClient";
import type { PostCallContent } from "@/lib/schemas/recommendation";

export const dynamic = "force-dynamic";

export default async function CallReviewPage({ params }: { params: { id: string } }) {
  const ctx = await requireTenant();
  const call = await db.call.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    include: {
      customer: { select: { id: true, name: true } },
      review: true,
      resolution: true,
      segments: { where: { isInterim: false }, select: { id: true }, take: 1 },
    },
  });
  if (!call) notFound();

  return (
    <ReviewClient
      callId={call.id}
      callTitle={call.title}
      callStatus={call.status}
      customerName={call.customer?.name ?? null}
      hasTranscript={call.segments.length > 0}
      initialReview={(call.review?.content as PostCallContent | undefined) ?? null}
      initialResolution={
        call.resolution
          ? {
              finalIssueSummary: call.resolution.finalIssueSummary,
              confirmedRootCause: call.resolution.confirmedRootCause,
              finalResolution: call.resolution.finalResolution,
              customerConfirmedFix: call.resolution.customerConfirmedFix,
              followUpRequired: call.resolution.followUpRequired,
              engineeringEscalation: call.resolution.engineeringEscalation,
              docsToUpdate: call.resolution.docsToUpdate,
            }
          : null
      }
      readOnly={ctx.role === "READ_ONLY"}
    />
  );
}
