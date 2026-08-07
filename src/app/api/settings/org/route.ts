import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";

export const GET = apiHandler(async () => {
  const ctx = await requireTenant();
  const settings = await db.organizationSetting.findMany({ where: { organizationId: ctx.organizationId } });
  return NextResponse.json({
    organization: { id: ctx.organizationId, name: ctx.organizationName },
    role: ctx.role,
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    providers: {
      ai: env.AI_PROVIDER,
      embeddings: env.EMBEDDING_PROVIDER,
      transcription: env.TRANSCRIPTION_PROVIDER,
      storage: env.STORAGE_DRIVER,
    },
  });
});

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  settings: z.record(z.unknown()).optional(),
});

const ALLOWED_SETTING_KEYS = new Set(["dataRetentionDays", "recordingEnabled", "recordingConsentText", "kbAutoPublishResolvedCases"]);

export const PATCH = apiHandler(async (req: Request) => {
  const ctx = await requireTenant("ADMIN");
  const body = patchSchema.parse(await req.json());
  if (body.name) {
    await db.organization.update({ where: { id: ctx.organizationId }, data: { name: body.name } });
  }
  if (body.settings) {
    for (const [key, value] of Object.entries(body.settings)) {
      if (!ALLOWED_SETTING_KEYS.has(key)) continue;
      await db.organizationSetting.upsert({
        where: { organizationId_key: { organizationId: ctx.organizationId, key } },
        update: { value: value as object },
        create: { organizationId: ctx.organizationId, key, value: value as object },
      });
    }
  }
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "settings.update", resourceType: "organization", resourceId: ctx.organizationId });
  return NextResponse.json({ ok: true });
});

export const DELETE = apiHandler(async () => {
  const ctx = await requireTenant("ADMIN");
  // Soft-delete the org; cascading hard delete is an explicit follow-up job in production.
  await db.organization.update({ where: { id: ctx.organizationId }, data: { deletedAt: new Date() } });
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "data.delete", resourceType: "organization", resourceId: ctx.organizationId });
  return NextResponse.json({ ok: true });
});
