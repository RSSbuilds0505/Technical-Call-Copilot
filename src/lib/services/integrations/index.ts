import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { Connector } from "./types";
import { MockConnector } from "./mock";
import { HubSpotConnector } from "./hubspot";

export const SUPPORTED_PROVIDERS = [
  "hubspot", "salesforce", "jira", "asana", "github", "slack", "gdrive", "notion", "confluence", "zendesk", "mock",
] as const;

/** Providers with a working implementation; others show as "planned" in settings. */
export const IMPLEMENTED_PROVIDERS = new Set(["hubspot", "mock"]);

export async function getConnector(organizationId: string, provider: string): Promise<Connector> {
  if (provider === "mock") return new MockConnector();
  const conn = await db.integrationConnection.findUnique({
    where: { organizationId_provider: { organizationId, provider } },
  });
  if (!conn?.encryptedCredentials) throw new Error(`${provider} is not connected for this organization.`);
  const credentials = decryptSecret(conn.encryptedCredentials);
  switch (provider) {
    case "hubspot":
      return new HubSpotConnector(credentials);
    default:
      throw new Error(`The ${provider} connector is defined but not implemented yet.`);
  }
}
