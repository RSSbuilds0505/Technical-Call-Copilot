import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiHandler } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { IMPLEMENTED_PROVIDERS, SUPPORTED_PROVIDERS } from "@/lib/services/integrations";

export const GET = apiHandler(async () => {
  const ctx = await requireTenant("MANAGER");
  const connections = await db.integrationConnection.findMany({
    where: { organizationId: ctx.organizationId },
    // encryptedCredentials is intentionally never selected.
    select: { provider: true, displayName: true, status: true, readOnly: true, credentialHint: true, lastSyncedAt: true },
  });
  const byProvider = new Map(connections.map((c) => [c.provider, c]));
  return NextResponse.json({
    providers: SUPPORTED_PROVIDERS.map((p) => ({
      provider: p,
      implemented: IMPLEMENTED_PROVIDERS.has(p),
      connection: byProvider.get(p) ?? null,
    })),
  });
});
