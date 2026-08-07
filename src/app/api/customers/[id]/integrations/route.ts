import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, NotFoundError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";

const bodySchema = z.object({
  sourceSystem: z.string().min(1).max(120),
  targetSystem: z.string().min(1).max(120),
  syncType: z.string().max(60).optional().nullable(),
  direction: z.string().max(30).optional().nullable(),
  status: z.string().max(30).optional().nullable(),
});

export const POST = apiHandler(async (req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireTenant("SPECIALIST");
  const customer = await db.customer.findFirst({ where: { id: params.id, organizationId: ctx.organizationId, deletedAt: null } });
  if (!customer) throw new NotFoundError("Customer not found.");
  const body = bodySchema.parse(await req.json());
  const integration = await db.customerIntegration.create({ data: { ...body, customerId: customer.id } });
  return NextResponse.json({ integration }, { status: 201 });
});
