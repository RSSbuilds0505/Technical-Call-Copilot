import type { Connector, ConnectorRecord } from "./types";

/**
 * HubSpot read-only connector using a private-app access token.
 * Implements contact search via the CRM v3 Search API. Requires crm.objects.contacts.read.
 */
export class HubSpotConnector implements Connector {
  readonly provider = "hubspot";
  readonly readOnly = true as const;

  constructor(private accessToken: string) {}

  private async request(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`https://api.hubapi.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const res = await this.request("/crm/v3/objects/contacts?limit=1");
    if (res.status === 401) return { ok: false, message: "HubSpot rejected the access token. Check the private app token and scopes." };
    if (!res.ok) return { ok: false, message: `HubSpot returned ${res.status}. Verify the token has crm.objects.contacts.read.` };
    return { ok: true, message: "Connected to HubSpot (read-only)." };
  }

  async search(query: string, limit = 5): Promise<ConnectorRecord[]> {
    const res = await this.request("/crm/v3/objects/contacts/search", {
      method: "POST",
      body: JSON.stringify({
        query,
        limit,
        properties: ["firstname", "lastname", "email", "lifecyclestage", "hs_lead_status"],
      }),
    });
    if (!res.ok) throw new Error(`HubSpot search failed (${res.status}).`);
    const data = (await res.json()) as { results?: { id: string; properties: Record<string, string | null> }[] };
    return (data.results ?? []).map((r) => ({
      id: r.id,
      type: "contact",
      title: `${r.properties.firstname ?? ""} ${r.properties.lastname ?? ""}`.trim() || r.properties.email || `Contact ${r.id}`,
      summary: `${r.properties.email ?? "no email"} · lifecycle: ${r.properties.lifecyclestage ?? "n/a"} · lead status: ${r.properties.hs_lead_status ?? "n/a"}`,
    }));
  }
}
