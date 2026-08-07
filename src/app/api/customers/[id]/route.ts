import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiHandler, NotFoundError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { customerBodySchema } from "@/lib/schemas/customer";

async function loadCustomer(id: string, organizationId: string) {
  const customer = await db.customer.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: {
      contacts: true,
      technologies: true,
      integrations: true,
      issues: { orderBy: { createdAt: "desc" } },
      actionItems: { where: { status: "open" }, orderBy: { createdAt: "desc" } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20 },
      calls: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, title: true, callType: true, status: true, createdAt: true } },
    },
  });
  if (!customer) throw new NotFoundError("Customer not found.");
  return customer;
}

export const GET = apiHandler(async (_req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireTenant();
  return NextResponse.json({ customer: await loadCustomer(params.id, ctx.organizationId) });
});

export const PATCH = apiHandler(async (req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireTenant("SPECIALIST");
  await loadCustomer(params.id, ctx.organizationId);
  const body = customerBodySchema.partial().parse(await req.json());
  const customer = await db.customer.update({
    where: { id: params.id },
    data: { ...body, customTerminology: body.customTerminology as object | undefined },
  });
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "customer.update", resourceType: "customer", resourceId: customer.id });
  return NextResponse.json({ customer });
});

export const DELETE = apiHandler(async (_req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireTenant("MANAGER");
  await loadCustomer(params.id, ctx.organizationId);
  await db.customer.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "customer.delete", resourceType: "customer", resourceId: params.id });
  return NextResponse.json({ ok: true });
});
