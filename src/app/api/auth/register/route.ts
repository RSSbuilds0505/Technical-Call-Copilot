import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, AppError } from "@/lib/errors";
import { createSession, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit, clientKey } from "@/lib/rateLimit";

const bodySchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().transform((e) => e.toLowerCase()),
  password: z.string().min(10, "Password must be at least 10 characters."),
  organizationName: z.string().min(1).max(120),
});

export const POST = apiHandler(async (req: Request) => {
  rateLimit(clientKey(req, "auth:register"), 5, 60 * 60_000);
  const body = bodySchema.parse(await req.json());
  const existing = await db.user.findUnique({ where: { email: body.email } });
  if (existing) throw new AppError("An account with this email already exists.", 409, "email_taken");

  const user = await db.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      memberships: {
        create: { role: "ADMIN", organization: { create: { name: body.organizationName } } },
      },
    },
    include: { memberships: true },
  });
  const organizationId = user.memberships[0].organizationId;
  await createSession({ userId: user.id, organizationId });
  await audit({ organizationId, userId: user.id, action: "user.register", resourceType: "user", resourceId: user.id });
  return NextResponse.json({ ok: true });
});
