import Link from "next/link";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { CallFilters } from "@/components/CallFilters";

export const dynamic = "force-dynamic";

export default async function CallsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = await requireTenant();
  const where: Record<string, unknown> = { organizationId: ctx.organizationId };
  if (searchParams.customerId) where.customerId = searchParams.customerId;
  if (searchParams.callType) where.callType = searchParams.callType;
  if (searchParams.ownerId) where.ownerId = searchParams.ownerId;
  if (searchParams.resolved === "true") where.resolution = { is: { customerConfirmedFix: true } };
  if (searchParams.resolved === "false") where.OR = [{ resolution: null }, { resolution: { is: { customerConfirmedFix: false } } }];
  if (searchParams.escalated === "true") where.resolution = { is: { engineeringEscalation: true } };
  if (searchParams.from || searchParams.to) {
    where.createdAt = {
      ...(searchParams.from ? { gte: new Date(searchParams.from) } : {}),
      ...(searchParams.to ? { lte: new Date(searchParams.to + "T23:59:59") } : {}),
    };
  }

  const [calls, customers, members] = await Promise.all([
    db.call.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        customer: { select: { name: true } },
        owner: { select: { name: true } },
        resolution: { select: { customerConfirmedFix: true, engineeringEscalation: true } },
        _count: { select: { recommendations: true } },
      },
    }),
    db.customer.findMany({ where: { organizationId: ctx.organizationId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.organizationMembership.findMany({ where: { organizationId: ctx.organizationId }, include: { user: { select: { id: true, name: true } } } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Call history</h1>
        <Link href="/calls/new"><Button>New call</Button></Link>
      </div>
      <CallFilters customers={customers} users={members.map((m) => ({ id: m.user.id, name: m.user.name }))} />
      {calls.length === 0 ? (
        <EmptyState title="No calls match these filters" hint="Adjust the filters or start a new call." />
      ) : (
        <div className="space-y-2">
          {calls.map((c) => (
            <Link key={c.id} href={c.status === "ENDED" ? `/calls/${c.id}/review` : `/calls/${c.id}/live`} className="block">
              <Card className="flex flex-wrap items-center justify-between gap-2 hover:border-signal/50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="text-xs text-muted">
                    {c.customer?.name ?? "No customer"} · {c.callType.replace("_", " ")} · {c.owner.name} · {formatDate(c.createdAt)} · {c._count.recommendations} recs
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {c.resolution?.engineeringEscalation && <Badge tone="danger">Escalated</Badge>}
                  {c.resolution?.customerConfirmedFix && <Badge tone="ok">Resolved</Badge>}
                  <Badge tone={c.status === "LIVE" ? "ok" : "default"}>{c.status}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
