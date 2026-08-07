/**
 * Read-only connector abstraction. Connectors surface external context (records,
 * tickets, docs) into the copilot; the MVP never writes to customer systems.
 * All connector access is scoped to an organization's stored (encrypted) credentials.
 */
export interface ConnectorRecord {
  id: string;
  type: string;
  title: string;
  url?: string;
  summary?: string;
  raw?: Record<string, unknown>;
}

export interface Connector {
  readonly provider: string;
  readonly readOnly: true;
  /** Verifies credentials with a harmless read call. */
  testConnection(): Promise<{ ok: boolean; message: string }>;
  /** Searches records relevant to a query (contacts, tickets, pages, ...). */
  search(query: string, limit?: number): Promise<ConnectorRecord[]>;
}

export type ConnectorFactory = (credentials: string, config?: Record<string, unknown>) => Connector;
