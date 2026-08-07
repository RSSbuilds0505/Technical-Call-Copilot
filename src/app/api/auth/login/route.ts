import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, AppError } from "@/lib/errors";
import { createSession, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit, clientKey } from "@/lib/rateLimit";

const bodySchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  password: z.string().min(1),
});

export const POST = apiHandler(async (req: Request) => {
  rateLimit(clientKey(req, "auth:login"), 10, 15 * 60_000);
  const body = bodySchema.parse(await req.json());
  const user = await db.user.findUnique({ where: { email: body.email }, include: { memberships: true } });
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    throw new AppError("Email or password is incorrect.", 401, "invalid_credentials");
  }
  const organizationId = user.memberships[0]?.organizationId ?? null;
  await createSession({ userId: user.id, organizationId });
  if (organizationId) {
    await audit({ organizationId, userId: user.id, action: "user.login", resourceType: "user", resourceId: user.id });
  }
  return NextResponse.json({ ok: true });
});
