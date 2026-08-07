import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { DocumentsClient } from "@/components/DocumentsClient";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const ctx = await requireTenant();
  const customers = await db.customer.findMany({
    where: { organizationId: ctx.organizationId, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return <DocumentsClient customers={customers} />;
}
