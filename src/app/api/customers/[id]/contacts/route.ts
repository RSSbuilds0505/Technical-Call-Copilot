import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, NotFoundError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";

const bodySchema = z.object({
  name: z.string().min(1).max(120),
  title: z.string().max(120).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  isPrimary: z.boolean().default(false),
});

export const POST = apiHandler(async (req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireTenant("SPECIALIST");
  const customer = await db.customer.findFirst({ where: { id: params.id, organizationId: ctx.organizationId, deletedAt: null } });
  if (!customer) throw new NotFoundError("Customer not found.");
  const body = bodySchema.parse(await req.json());
  const contact = await db.customerContact.create({ data: { ...body, customerId: customer.id } });
  return NextResponse.json({ contact }, { status: 201 });
});
