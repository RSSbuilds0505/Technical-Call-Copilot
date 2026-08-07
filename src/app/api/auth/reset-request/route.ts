import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler } from "@/lib/errors";
import { sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { rateLimit, clientKey } from "@/lib/rateLimit";

const bodySchema = z.object({ email: z.string().email().transform((e) => e.toLowerCase()) });

export const POST = apiHandler(async (req: Request) => {
  rateLimit(clientKey(req, "auth:reset"), 5, 60 * 60_000);
  const { email } = bodySchema.parse(await req.json());
  const user = await db.user.findUnique({ where: { email } });
  // Always respond identically so account existence can't be probed.
  if (user) {
    const token = randomBytes(32).toString("hex");
    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const link = `${env.APP_URL}/reset?token=${token}`;
    if (env.RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: email, subject: "Reset your password", text: `Reset your Technical Call Copilot password: ${link}\nThis link expires in 1 hour.` }),
      }).catch((err) => console.error("Reset email send failed:", err));
    } else {
      console.info(`[password-reset] No email provider configured. Reset link for ${email}: ${link}`);
    }
  }
  return NextResponse.json({ ok: true, message: "If that email has an account, a reset link is on its way." });
});
