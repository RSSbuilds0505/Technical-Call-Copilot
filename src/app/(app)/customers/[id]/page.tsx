import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { Badge, Card } from "@/components/ui";
import { CustomerForm } from "@/components/CustomerForm";
import { CustomerDangerZone, CustomerSubEntities } from "@/components/CustomerDetailClient";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireTenant();
  const customer = await db.customer.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId, deletedAt: null },
    include: {
      contacts: true,
      technologies: true,
      integrations: true,
      issues: { orderBy: { createdAt: "desc" } },
      actionItems: { where: { status: "open" } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 15 },
      calls: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{customer.name}</h1>
          <p className="text-xs text-muted">Updated {formatDate(customer.updatedAt)}</p>
        </div>
        <Link href={`/calls/new?customerId=${customer.id}`} className="text-sm text-signal hover:underline">Start a call with this customer →</Link>
      </div>

      <CustomerSubEntities
        customerId={customer.id}
        contacts={customer.contacts}
        technologies={customer.technologies}
        integrations={customer.integrations}
        issues={customer.issues}
      />

      <section className="grid gap-3 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-medium text-muted">Recent calls</h2>
          {customer.calls.length === 0 ? <p className="text-xs text-muted">No calls yet.</p> : (
            <ul className="space-y-1.5">
              {customer.calls.map((c) => (
                <li key={c.id}>
                  <Link href={c.status === "ENDED" ? `/calls/${c.id}/review` : `/calls/${c.id}/live`} className="flex items-center justify-between text-sm hover:text-signal">
                    <span className="truncate">{c.title}</span>
                    <Badge>{c.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-medium text-muted">Documents</h2>
          {customer.documents.length === 0 ? <p className="text-xs text-muted">No customer documents. Upload from the Knowledge base page.</p> : (
            <ul className="space-y-1.5">
              {customer.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{d.title}</span>
                  <Badge tone={d.status === "READY" ? "ok" : d.status === "FAILED" ? "danger" : "warn"}>{d.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">Workspace details</h2>
        <CustomerForm initial={{ ...customer, customTerminology: (customer.customTerminology as { term: string; meaning: string }[]) ?? [] }} />
      </section>

      <CustomerDangerZone customerId={customer.id} customerName={customer.name} />
    </div>
  );
}
