import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, NotFoundError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";

const bodySchema = z.object({ name: z.string().min(1).max(120), category: z.string().max(60).optional().nullable() });

export const POST = apiHandler(async (req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireTenant("SPECIALIST");
  const customer = await db.customer.findFirst({ where: { id: params.id, organizationId: ctx.organizationId, deletedAt: null } });
  if (!customer) throw new NotFoundError("Customer not found.");
  const body = bodySchema.parse(await req.json());
  const technology = await db.customerTechnology.create({ data: { ...body, customerId: customer.id } });
  return NextResponse.json({ technology }, { status: 201 });
});
