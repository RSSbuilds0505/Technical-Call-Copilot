import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { customerBodySchema } from "@/lib/schemas/customer";

export const GET = apiHandler(async () => {
  const ctx = await requireTenant();
  const customers = await db.customer.findMany({
    where: { organizationId: ctx.organizationId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { calls: true, documents: true, issues: true } } },
  });
  return NextResponse.json({ customers });
});

export const POST = apiHandler(async (req: Request) => {
  const ctx = await requireTenant("SPECIALIST");
  const body = customerBodySchema.parse(await req.json());
  const customer = await db.customer.create({
    data: { ...body, customTerminology: body.customTerminology as object, organizationId: ctx.organizationId },
  });
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "customer.create", resourceType: "customer", resourceId: customer.id, metadata: { name: customer.name } });
  return NextResponse.json({ customer }, { status: 201 });
});
