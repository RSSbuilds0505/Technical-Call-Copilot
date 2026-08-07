import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, AppError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";

export const GET = apiHandler(async () => {
  const ctx = await requireTenant("MANAGER");
  const members = await db.organizationMembership.findMany({
    where: { organizationId: ctx.organizationId },
    include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ members });
});

const inviteSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  name: z.string().min(1).max(120),
  role: z.enum(["ADMIN", "MANAGER", "SPECIALIST", "READ_ONLY"]),
  temporaryPassword: z.string().min(10),
});

/** MVP invite: creates the account with a temporary password the admin shares out-of-band. */
export const POST = apiHandler(async (req: Request) => {
  const ctx = await requireTenant("ADMIN");
  const body = inviteSchema.parse(await req.json());
  let user = await db.user.findUnique({ where: { email: body.email } });
  if (!user) {
    user = await db.user.create({
      data: { email: body.email, name: body.name, passwordHash: await hashPassword(body.temporaryPassword) },
    });
  }
  const existing = await db.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: ctx.organizationId, userId: user.id } },
  });
  if (existing) throw new AppError("That person is already a member of this organization.", 409, "already_member");
  await db.organizationMembership.create({
    data: { organizationId: ctx.organizationId, userId: user.id, role: body.role },
  });
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "user.invite", resourceType: "user", resourceId: user.id, metadata: { role: body.role } });
  return NextResponse.json({ ok: true }, { status: 201 });
});

const roleSchema = z.object({ userId: z.string().uuid(), role: z.enum(["ADMIN", "MANAGER", "SPECIALIST", "READ_ONLY"]) });

export const PATCH = apiHandler(async (req: Request) => {
  const ctx = await requireTenant("ADMIN");
  const body = roleSchema.parse(await req.json());
  const membership = await db.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: ctx.organizationId, userId: body.userId } },
  });
  if (!membership) throw new AppError("That person isn't a member of this organization.", 404, "not_found");
  await db.organizationMembership.update({ where: { id: membership.id }, data: { role: body.role } });
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "role.change", resourceType: "user", resourceId: body.userId, metadata: { role: body.role } });
  return NextResponse.json({ ok: true });
});
