import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, AppError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";

const CALL_TYPES = ["discovery", "demo", "implementation", "troubleshooting", "support", "architecture_review", "customer_success", "escalation", "internal", "other"] as const;

const createSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  callType: z.enum(CALL_TYPES),
  meetingPlatform: z.string().max(60).nullable().optional(),
  products: z.array(z.string().max(120)).default([]),
  objective: z.string().max(2000).nullable().optional(),
  knownIssue: z.string().max(2000).nullable().optional(),
  participants: z.array(z.object({ name: z.string().min(1).max(120), roleType: z.enum(["customer", "specialist", "internal", "other"]) })).default([]),
  consentConfirmed: z.literal(true, { errorMap: () => ({ message: "Confirm participant consent before creating a live call." }) }),
});

export const GET = apiHandler(async (req: Request) => {
  const ctx = await requireTenant();
  const url = new URL(req.url);
  const where: Record<string, unknown> = { organizationId: ctx.organizationId };
  const customerId = url.searchParams.get("customerId");
  const callType = url.searchParams.get("callType");
  const status = url.searchParams.get("status");
  const ownerId = url.searchParams.get("ownerId");
  const resolved = url.searchParams.get("resolved");
  const escalated = url.searchParams.get("escalated");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (customerId) where.customerId = customerId;
  if (callType) where.callType = callType;
  if (status) where.status = status;
  if (ownerId) where.ownerId = ownerId;
  if (from || to) where.createdAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
  if (resolved === "true") where.resolution = { is: { customerConfirmedFix: true } };
  if (resolved === "false") where.OR = [{ resolution: null }, { resolution: { is: { customerConfirmedFix: false } } }];
  if (escalated === "true") where.resolution = { is: { engineeringEscalation: true } };

  const calls = await db.call.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      customer: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      resolution: { select: { customerConfirmedFix: true, engineeringEscalation: true } },
      _count: { select: { recommendations: true, segments: true } },
    },
  });
  return NextResponse.json({ calls });
});

export const POST = apiHandler(async (req: Request) => {
  const ctx = await requireTenant("SPECIALIST");
  const body = createSchema.parse(await req.json());
  if (body.customerId) {
    const customer = await db.customer.findFirst({ where: { id: body.customerId, organizationId: ctx.organizationId, deletedAt: null } });
    if (!customer) throw new AppError("That customer doesn't exist in your organization.", 404, "not_found");
  }
  const call = await db.call.create({
    data: {
      organizationId: ctx.organizationId,
      customerId: body.customerId ?? null,
      ownerId: ctx.userId,
      title: body.title,
      callType: body.callType,
      meetingPlatform: body.meetingPlatform ?? null,
      products: body.products,
      objective: body.objective ?? null,
      knownIssue: body.knownIssue ?? null,
      consentConfirmed: true,
      status: "DRAFT",
      participants: { create: body.participants },
    },
  });
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "call.create", resourceType: "call", resourceId: call.id, metadata: { title: call.title } });
  return NextResponse.json({ call }, { status: 201 });
});
