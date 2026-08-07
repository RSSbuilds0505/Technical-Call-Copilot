import Link from "next/link";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const ctx = await requireTenant();
  const customers = await db.customer.findMany({
    where: { organizationId: ctx.organizationId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { calls: true, documents: true } }, issues: { where: { status: "open" }, select: { id: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Customers</h1>
        <Link href="/customers/new"><Button>Add customer</Button></Link>
      </div>
      {customers.length === 0 ? (
        <EmptyState title="No customer workspaces yet" hint="A workspace holds a customer's stack, integrations, known issues, and documents — the context the copilot uses live." action={<Link href="/customers/new"><Button size="sm">Create the first one</Button></Link>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {customers.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}`}>
              <Card className="h-full hover:border-signal/50">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted">{[c.crmPlatform, c.subscriptionTier, c.industry].filter(Boolean).join(" · ") || "No platform details yet"}</p>
                  </div>
                  {c.issues.length > 0 && <Badge tone="warn">{c.issues.length} open issue{c.issues.length > 1 ? "s" : ""}</Badge>}
                </div>
                <p className="mt-3 text-xs text-muted">{c._count.calls} calls · {c._count.documents} docs · updated {formatDate(c.updatedAt)}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
