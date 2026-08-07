import { Card, EmptyState } from "@/components/ui";
import { requireTenant } from "@/lib/tenant";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Analytics are computed live from stored calls, recommendations, feedback,
 * and resolutions. Renders server-side with the same logic as /api/analytics
 * (route kept for programmatic access).
 */
export default async function AnalyticsPage() {
  const ctx = await requireTenant();
  const orgId = ctx.organizationId;

  const [totalCalls, questionsDetected, recsGenerated, feedbackRows, resolutions, recs, sources] = await Promise.all([
    db.call.count({ where: { organizationId: orgId } }),
    db.detectedEvent.count({ where: { organizationId: orgId, eventType: { in: ["technical_question", "troubleshooting_issue", "integration_issue", "workflow_issue", "data_issue", "architecture_question", "permissions_issue"] } } }),
    db.recommendation.count({ where: { organizationId: orgId } }),
    db.recommendationFeedback.findMany({ where: { organizationId: orgId }, select: { rating: true, usedOnCall: true, issueResolved: true, escalated: true } }),
    db.resolution.findMany({ where: { organizationId: orgId }, select: { customerConfirmedFix: true, engineeringEscalation: true, createdAt: true, call: { select: { startedAt: true } } } }),
    db.recommendation.findMany({ where: { organizationId: orgId }, select: { eventType: true, latencyMs: true, call: { select: { customer: { select: { crmPlatform: true } } } } } }),
    db.recommendationSource.groupBy({ by: ["title"], _count: { title: true }, orderBy: { _count: { title: "desc" } }, take: 5, where: { recommendation: { organizationId: orgId } } }),
  ]);

  const helpful = feedbackRows.filter((f) => f.rating === "helpful").length;
  const used = feedbackRows.filter((f) => f.usedOnCall).length;
  const acceptanceRate = feedbackRows.length > 0 ? (helpful + used) / feedbackRows.length : null;

  const categoryCounts: Record<string, number> = {};
  const platformCounts: Record<string, number> = {};
  let latencySum = 0;
  let latencyCount = 0;
  for (const r of recs) {
    categoryCounts[r.eventType] = (categoryCounts[r.eventType] ?? 0) + 1;
    const platform = r.call.customer?.crmPlatform ?? "unspecified";
    platformCounts[platform] = (platformCounts[platform] ?? 0) + 1;
    if (r.latencyMs) {
      latencySum += r.latencyMs;
      latencyCount++;
    }
  }

  let resolutionSum = 0;
  let resolutionCount = 0;
  for (const r of resolutions) {
    if (r.call.startedAt) {
      resolutionSum += r.createdAt.getTime() - r.call.startedAt.getTime();
      resolutionCount++;
    }
  }

  const stats: { label: string; value: string }[] = [
    { label: "Calls", value: String(totalCalls) },
    { label: "Technical questions detected", value: String(questionsDetected) },
    { label: "Guidance cards generated", value: String(recsGenerated) },
    { label: "Guidance acceptance rate", value: acceptanceRate !== null ? `${Math.round(acceptanceRate * 100)}%` : "no feedback yet" },
    { label: "Issues resolved on-call", value: String(feedbackRows.filter((f) => f.issueResolved).length + resolutions.filter((r) => r.customerConfirmedFix).length) },
    { label: "Escalations", value: String(feedbackRows.filter((f) => f.escalated).length + resolutions.filter((r) => r.engineeringEscalation).length) },
    { label: "Avg time to guidance", value: latencyCount > 0 ? `${(latencySum / latencyCount / 1000).toFixed(1)}s` : "n/a" },
    { label: "Avg time to resolution", value: resolutionCount > 0 ? `${Math.round(resolutionSum / resolutionCount / 60000)} min` : "n/a" },
  ];

  const categories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const platforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCategory = categories[0]?.[1] ?? 1;
  const maxPlatform = platforms[0]?.[1] ?? 1;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-white">Analytics</h1>
        <p className="mt-1 text-sm text-muted">Computed live from your calls, guidance feedback, and resolutions.</p>
      </header>

      {totalCalls === 0 ? (
        <EmptyState title="No data yet" hint="Run your first call and analytics will populate from real activity." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label}>
                <p className="text-xs text-muted">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold text-white">{s.value}</p>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Top issue categories">
              {categories.length === 0 ? (
                <p className="text-sm text-muted">No guidance generated yet.</p>
              ) : (
                <BarList rows={categories.map(([k, v]) => ({ label: k.replace(/_/g, " "), count: v }))} max={maxCategory} />
              )}
            </Card>
            <Card title="Platforms generating the most questions">
              {platforms.length === 0 ? (
                <p className="text-sm text-muted">No platform data yet.</p>
              ) : (
                <BarList rows={platforms.map(([k, v]) => ({ label: k, count: v }))} max={maxPlatform} />
              )}
            </Card>
          </div>

          <Card title="Most-cited knowledge base documents" subtitle="Documents the copilot leans on most when answering">
            {sources.length === 0 ? (
              <p className="text-sm text-muted">No sources cited yet. Upload documents and run calls to populate this.</p>
            ) : (
              <ul className="space-y-2">
                {sources.map((s) => (
                  <li key={s.title} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2 text-sm">
                    <span className="text-gray-100">📄 {s.title}</span>
                    <span className="text-xs text-muted">{s._count.title} citation{s._count.title === 1 ? "" : "s"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function BarList(props: { rows: { label: string; count: number }[]; max: number }) {
  return (
    <ul className="space-y-2">
      {props.rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="mb-1 flex items-center justify-between">
            <span className="capitalize text-gray-200">{r.label}</span>
            <span className="text-xs text-muted">{r.count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-signal" style={{ width: `${Math.max(6, (r.count / props.max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
