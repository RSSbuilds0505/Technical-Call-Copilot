import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, AppError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { credentialHint, encryptSecret } from "@/lib/crypto";
import { getConnector, IMPLEMENTED_PROVIDERS, SUPPORTED_PROVIDERS } from "@/lib/services/integrations";
import { HubSpotConnector } from "@/lib/services/integrations/hubspot";

const bodySchema = z.object({ credential: z.string().min(4).max(500) });

export const POST = apiHandler(async (req: Request, { params }: { params: { provider: string } }) => {
  const ctx = await requireTenant("ADMIN");
  const provider = params.provider;
  if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(provider)) throw new AppError("Unknown provider.", 404, "not_found");
  if (!IMPLEMENTED_PROVIDERS.has(provider)) throw new AppError("This connector is planned but not implemented yet.", 400, "not_implemented");

  const { credential } = bodySchema.parse(await req.json());
  // Verify with a read-only call before saving.
  const test = provider === "hubspot" ? await new HubSpotConnector(credential).testConnection() : { ok: true, message: "OK" };
  if (!test.ok) throw new AppError(test.message, 400, "connection_failed");

  await db.integrationConnection.upsert({
    where: { organizationId_provider: { organizationId: ctx.organizationId, provider } },
    update: { encryptedCredentials: encryptSecret(credential), credentialHint: credentialHint(credential), status: "connected" },
    create: {
      organizationId: ctx.organizationId,
      provider,
      displayName: provider === "hubspot" ? "HubSpot (read-only)" : provider,
      encryptedCredentials: encryptSecret(credential),
      credentialHint: credentialHint(credential),
      status: "connected",
      readOnly: true,
    },
  });
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "integration.connect", resourceType: "integration", resourceId: provider });
  return NextResponse.json({ ok: true, message: test.message });
});

export const DELETE = apiHandler(async (_req: Request, { params }: { params: { provider: string } }) => {
  const ctx = await requireTenant("ADMIN");
  await db.integrationConnection.deleteMany({ where: { organizationId: ctx.organizationId, provider: params.provider } });
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "integration.disconnect", resourceType: "integration", resourceId: params.provider });
  return NextResponse.json({ ok: true });
});

/** Read-only search through a connected provider (or the mock connector). */
export const PUT = apiHandler(async (req: Request, { params }: { params: { provider: string } }) => {
  const ctx = await requireTenant("SPECIALIST");
  const { query } = z.object({ query: z.string().max(300).default("") }).parse(await req.json());
  const connector = await getConnector(ctx.organizationId, params.provider);
  const records = await connector.search(query, 5);
  return NextResponse.json({ records });
});
