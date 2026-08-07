import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { NewCallForm } from "@/components/NewCallForm";

export const dynamic = "force-dynamic";

export default async function NewCallPage({ searchParams }: { searchParams: { customerId?: string } }) {
  const ctx = await requireTenant("SPECIALIST");
  const customers = await db.customer.findMany({
    where: { organizationId: ctx.organizationId, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">New call</h1>
      <NewCallForm customers={customers} defaultCustomerId={searchParams.customerId} specialistName={ctx.userName} />
    </div>
  );
}
