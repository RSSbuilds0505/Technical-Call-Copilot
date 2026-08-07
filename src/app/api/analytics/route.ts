import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiHandler } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";

/** Analytics computed live from stored data — no hardcoded values. */
export const GET = apiHandler(async () => {
  const ctx = await requireTenant();
  const orgId = ctx.organizationId;

  const [totalCalls, questionsDetected, recsGenerated, feedbackRows, resolutions, recs, sources] = await Promise.all([
    db.call.count({ where: { organizationId: orgId } }),
    db.detectedEvent.count({ where: { organizationId: orgId, eventType: { in: ["technical_question", "troubleshooting_issue", "integration_issue", "workflow_issue", "data_issue", "architecture_question", "permissions_issue"] } } }),
    db.recommendation.count({ where: { organizationId: orgId } }),
    db.recommendationFeedback.findMany({ where: { organizationId: orgId }, select: { rating: true, usedOnCall: true, issueResolved: true, escalated: true, incorrectDiagnosis: true, recommendationId: true } }),
    db.resolution.findMany({ where: { organizationId: orgId }, select: { customerConfirmedFix: true, engineeringEscalation: true, createdAt: true, call: { select: { startedAt: true } } } }),
    db.recommendation.findMany({ where: { organizationId: orgId }, select: { eventType: true, latencyMs: true, call: { select: { customer: { select: { crmPlatform: true } } } } } }),
    db.recommendationSource.groupBy({ by: ["title"], _count: { title: true }, orderBy: { _count: { title: "desc" } }, take: 5, where: { recommendation: { organizationId: orgId } } }),
  ]);

  const helpful = feedbackRows.filter((f) => f.rating === "helpful").length;
  const used = feedbackRows.filter((f) => f.usedOnCall).length;
  const incorrectByRec = new Map<string, number>();
  for (const f of feedbackRows) if (f.rating === "incorrect" || f.incorrectDiagnosis) incorrectByRec.set(f.recommendationId, (incorrectByRec.get(f.recommendationId) ?? 0) + 1);

  const categoryCounts: Record<string, number> = {};
  const platformCounts: Record<string, number> = {};
  let latencySum = 0, latencyCount = 0;
  for (const r of recs) {
    categoryCounts[r.eventType] = (categoryCounts[r.eventType] ?? 0) + 1;
    const platform = r.call.customer?.crmPlatform ?? "unspecified";
    platformCounts[platform] = (platformCounts[platform] ?? 0) + 1;
    if (r.latencyMs) { latencySum += r.latencyMs; latencyCount++; }
  }

  let resolutionTimeSum = 0, resolutionTimeCount = 0;
  for (const r of resolutions) {
    if (r.call.startedAt) { resolutionTimeSum += r.createdAt.getTime() - r.call.startedAt.getTime(); resolutionTimeCount++; }
  }

  return NextResponse.json({
    totalCalls,
    questionsDetected,
    recommendationsGenerated: recsGenerated,
    recommendationsHelpful: helpful,
    acceptanceRate: feedbackRows.length > 0 ? Number(((helpful + used) / feedbackRows.length).toFixed(2)) : null,
    issuesResolvedOnCall: feedbackRows.filter((f) => f.issueResolved).length + resolutions.filter((r) => r.customerConfirmedFix).length,
    issuesEscalated: feedbackRows.filter((f) => f.escalated).length + resolutions.filter((r) => r.engineeringEscalation).length,
    avgTimeToRecommendationMs: latencyCount > 0 ? Math.round(latencySum / latencyCount) : null,
    avgTimeToResolutionMs: resolutionTimeCount > 0 ? Math.round(resolutionTimeSum / resolutionTimeCount) : null,
    topIssueCategories: Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([category, count]) => ({ category, count })),
    topPlatforms: Object.entries(platformCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([platform, count]) => ({ platform, count })),
    mostHelpfulDocuments: sources.map((s) => ({ title: s.title, citations: s._count.title })),
    frequentlyIncorrect: incorrectByRec.size,
  });
});
