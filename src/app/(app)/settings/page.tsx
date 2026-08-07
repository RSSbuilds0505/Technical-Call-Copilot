import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { env } from "@/lib/env";
import { IMPLEMENTED_PROVIDERS, SUPPORTED_PROVIDERS } from "@/lib/services/integrations";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireTenant();
  if (!hasAtLeast(ctx.role, "MANAGER")) redirect("/dashboard");

  const [settings, members, connections] = await Promise.all([
    db.organizationSetting.findMany({ where: { organizationId: ctx.organizationId } }),
    db.organizationMembership.findMany({
      where: { organizationId: ctx.organizationId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.integrationConnection.findMany({
      where: { organizationId: ctx.organizationId },
      select: { provider: true, displayName: true, status: true, readOnly: true, credentialHint: true },
    }),
  ]);

  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  return (
    <SettingsClient
      organizationName={ctx.organizationName}
      role={ctx.role}
      settings={Object.fromEntries(settings.map((s) => [s.key, s.value]))}
      members={members.map((m) => ({ userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role, isSelf: m.user.id === ctx.userId }))}
      integrations={SUPPORTED_PROVIDERS.map((p) => ({
        provider: p,
        implemented: IMPLEMENTED_PROVIDERS.has(p),
        connection: byProvider.get(p) ?? null,
      }))}
      providers={{ ai: env.AI_PROVIDER, embeddings: env.EMBEDDING_PROVIDER, transcription: env.TRANSCRIPTION_PROVIDER, storage: env.STORAGE_DRIVER }}
    />
  );
}
