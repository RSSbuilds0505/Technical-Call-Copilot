import type { Connector, ConnectorRecord } from "./types";

/** Demo connector with deterministic sample data; used to exercise the connector UI end-to-end. */
export class MockConnector implements Connector {
  readonly provider = "mock";
  readonly readOnly = true as const;

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: "Mock connector is ready." };
  }

  async search(query: string, limit = 5): Promise<ConnectorRecord[]> {
    const samples: ConnectorRecord[] = [
      { id: "mock-1", type: "ticket", title: "Sync delay reported after workflow change", summary: "Customer reported records arriving 30+ minutes late after enrollment criteria were edited." },
      { id: "mock-2", type: "contact", title: "Jordan Reyes (RevOps Lead)", summary: "Primary technical contact for integration questions." },
      { id: "mock-3", type: "doc", title: "Integration runbook: Apollo to HubSpot", summary: "Internal runbook covering sync filters and list-based push configuration." },
    ];
    const q = query.toLowerCase();
    return samples.filter((s) => !q || s.title.toLowerCase().includes(q) || (s.summary ?? "").toLowerCase().includes(q)).slice(0, limit);
  }
}
