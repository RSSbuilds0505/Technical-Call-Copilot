import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiHandler } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";

/** Full JSON export of an organization's data (credentials excluded). */
export const GET = apiHandler(async () => {
  const ctx = await requireTenant("ADMIN");
  const orgId = ctx.organizationId;
  const [customers, documents, calls, recommendations, feedback, auditLogs] = await Promise.all([
    db.customer.findMany({ where: { organizationId: orgId }, include: { contacts: true, technologies: true, integrations: true, issues: true } }),
    db.document.findMany({ where: { organizationId: orgId }, select: { id: true, title: true, documentType: true, platform: true, customerId: true, status: true, createdAt: true } }),
    db.call.findMany({ where: { organizationId: orgId }, include: { segments: true, resolution: true, participants: true } }),
    db.recommendation.findMany({ where: { organizationId: orgId }, include: { sources: true } }),
    db.recommendationFeedback.findMany({ where: { organizationId: orgId } }),
    db.auditLog.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 1000 }),
  ]);
  await audit({ organizationId: orgId, userId: ctx.userId, action: "data.export", resourceType: "organization", resourceId: orgId });
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), customers, documents, calls, recommendations, feedback, auditLogs }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="tcc-export-${orgId.slice(0, 8)}.json"` },
  });
});
