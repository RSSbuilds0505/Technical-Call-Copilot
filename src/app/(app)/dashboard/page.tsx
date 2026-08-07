import Link from "next/link";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { Badge, Card, EmptyState } from "@/components/ui";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireTenant();
  const [liveCalls, recentCalls, customerCount, readyDocs, openItems] = await Promise.all([
    db.call.findMany({ where: { organizationId: ctx.organizationId, status: { in: ["LIVE", "PAUSED"] } }, include: { customer: { select: { name: true } } }, take: 5 }),
    db.call.findMany({ where: { organizationId: ctx.organizationId, status: "ENDED" }, orderBy: { endedAt: "desc" }, take: 5, include: { customer: { select: { name: true } }, resolution: { select: { customerConfirmedFix: true } } } }),
    db.customer.count({ where: { organizationId: ctx.organizationId, deletedAt: null } }),
    db.document.count({ where: { organizationId: ctx.organizationId, status: "READY", deletedAt: null } }),
    db.actionItem.count({ where: { organizationId: ctx.organizationId, status: "open" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <Link href="/calls/new"><Button>New call</Button></Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-xs uppercase tracking-wide text-muted">Customers</p><p className="mt-1 text-2xl font-semibold tabular-nums">{customerCount}</p></Card>
        <Card><p className="text-xs uppercase tracking-wide text-muted">Knowledge docs ready</p><p className="mt-1 text-2xl font-semibold tabular-nums">{readyDocs}</p></Card>
        <Card><p className="text-xs uppercase tracking-wide text-muted">Open action items</p><p className="mt-1 text-2xl font-semibold tabular-nums">{openItems}</p></Card>
      </div>

      {liveCalls.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted">In progress</h2>
          <div className="space-y-2">
            {liveCalls.map((c) => (
              <Link key={c.id} href={`/calls/${c.id}/live`} className="block">
                <Card className="flex items-center justify-between hover:border-signal/50">
                  <div>
                    <p className="text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted">{c.customer?.name ?? "No customer"} · {c.callType.replace("_", " ")}</p>
                  </div>
                  <Badge tone={c.status === "LIVE" ? "ok" : "warn"}>{c.status}</Badge>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">Recent calls</h2>
        {recentCalls.length === 0 ? (
          <EmptyState title="No calls yet" hint="Create a customer workspace, upload a doc or two, then start your first call." action={<Link href="/calls/new"><Button size="sm">Start a call</Button></Link>} />
        ) : (
          <div className="space-y-2">
            {recentCalls.map((c) => (
              <Link key={c.id} href={`/calls/${c.id}/review`} className="block">
                <Card className="flex items-center justify-between hover:border-signal/50">
                  <div>
                    <p className="text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted">{c.customer?.name ?? "No customer"} · {formatDate(c.endedAt)}</p>
                  </div>
                  <Badge tone={c.resolution?.customerConfirmedFix ? "ok" : "default"}>
                    {c.resolution?.customerConfirmedFix ? "Resolved" : "Ended"}
                  </Badge>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
