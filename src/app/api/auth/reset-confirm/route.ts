import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, AppError } from "@/lib/errors";
import { sha256 } from "@/lib/crypto";
import { hashPassword } from "@/lib/auth";

const bodySchema = z.object({ token: z.string().min(10), password: z.string().min(10) });

export const POST = apiHandler(async (req: Request) => {
  const { token, password } = bodySchema.parse(await req.json());
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError("This reset link is invalid or has expired. Request a new one.", 400, "invalid_token");
  }
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(password) } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  return NextResponse.json({ ok: true });
});
