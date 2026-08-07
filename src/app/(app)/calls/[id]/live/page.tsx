import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { transcriptionMode } from "@/lib/providers/transcription";
import { LiveWorkspace } from "@/components/call/LiveWorkspace";

export const dynamic = "force-dynamic";

export default async function LiveCallPage({ params }: { params: { id: string } }) {
  const ctx = await requireTenant();
  const call = await db.call.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    include: {
      customer: {
        include: {
          technologies: true,
          integrations: true,
          issues: { where: { status: { not: "resolved" } }, orderBy: { createdAt: "desc" }, take: 8 },
          actionItems: { where: { status: "open" }, take: 8 },
          documents: { where: { deletedAt: null, status: "READY" }, select: { id: true, title: true, documentType: true }, take: 10 },
          calls: {
            where: { id: { not: params.id }, status: "ENDED" },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { id: true, title: true, createdAt: true, resolution: { select: { finalIssueSummary: true, finalResolution: true, customerConfirmedFix: true } } },
          },
        },
      },
      participants: true,
      segments: { where: { isInterim: false }, orderBy: { spokenAt: "asc" } },
      recommendations: { orderBy: { createdAt: "asc" }, include: { sources: true } },
    },
  });
  if (!call) notFound();

  return (
    <LiveWorkspace
      call={JSON.parse(JSON.stringify(call))}
      specialistName={ctx.userName}
      transcriptionMode={transcriptionMode()}
      readOnly={ctx.role === "READ_ONLY"}
    />
  );
}
