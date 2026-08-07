"use client";

import { useState } from "react";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import type { CustomerContext } from "./LiveWorkspace";

interface SearchResult {
  documentId: string;
  title: string;
  section: string | null;
  tier: string;
  snippet: string;
  score: number;
}

export function ContextPanel(props: { customer: CustomerContext | null }) {
  const c = props.customer;

  return (
    <section aria-label="Customer context" className="flex min-h-0 flex-col rounded-lg border border-line bg-surface-1">
      <header className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Customer context</h2>
      </header>

      {!c ? (
        <div className="p-3">
          <EmptyState title="No customer linked" hint="This call is not linked to a customer workspace, so the copilot is using organization-level knowledge only." />
        </div>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto scroll-slim p-3 text-sm">
          <div>
            <p className="font-medium text-white">{c.name}</p>
            {c.description && <p className="mt-1 text-xs text-muted">{c.description}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.crmPlatform && <Badge tone="signal">{c.crmPlatform}</Badge>}
              {c.subscriptionTier && <Badge tone="neutral">{c.subscriptionTier}</Badge>}
            </div>
          </div>

          <ContextSearch customerId={c.id} />

          {c.technologies.length > 0 && (
            <ContextSection title="Tech stack">
              <div className="flex flex-wrap gap-1.5">
                {c.technologies.map((t) => (
                  <Badge key={t.id} tone="neutral">{t.name}</Badge>
                ))}
              </div>
            </ContextSection>
          )}

          {c.integrations.length > 0 && (
            <ContextSection title="Integrations">
              <ul className="space-y-1.5">
                {c.integrations.map((i) => (
                  <li key={i.id} className="rounded-md bg-surface-2 px-2.5 py-1.5 text-xs">
                    <span className="text-gray-100">{i.sourceSystem} → {i.targetSystem}</span>
                    <span className="ml-1 text-muted">
                      {i.syncType ? `· ${i.syncType}` : ""}
                      {i.status ? ` · ${i.status}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </ContextSection>
          )}

          {c.issues.length > 0 && (
            <ContextSection title="Open issues">
              <ul className="space-y-1.5">
                {c.issues.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-2 rounded-md bg-surface-2 px-2.5 py-1.5 text-xs">
                    <span className="text-gray-100">{i.title}</span>
                    <Badge tone={i.severity === "high" || i.severity === "critical" ? "danger" : i.severity === "medium" ? "warn" : "neutral"}>{i.severity}</Badge>
                  </li>
                ))}
              </ul>
            </ContextSection>
          )}

          {c.actionItems.length > 0 && (
            <ContextSection title="Open action items">
              <ul className="space-y-1 text-xs text-gray-300">
                {c.actionItems.map((a) => (
                  <li key={a.id}>☐ {a.description}</li>
                ))}
              </ul>
            </ContextSection>
          )}

          {c.customTerminology && c.customTerminology.length > 0 && (
            <ContextSection title="Their terminology">
              <ul className="space-y-1 text-xs">
                {c.customTerminology.map((t, i) => (
                  <li key={i}>
                    <span className="font-medium text-signal">{t.term}</span>
                    <span className="text-muted"> = {t.meaning}</span>
                  </li>
                ))}
              </ul>
            </ContextSection>
          )}

          {c.calls.length > 0 && (
            <ContextSection title="Past calls">
              <ul className="space-y-1.5">
                {c.calls.map((call) => (
                  <li key={call.id} className="rounded-md bg-surface-2 px-2.5 py-1.5 text-xs">
                    <a href={`/calls/${call.id}/review`} className="text-gray-100 hover:text-signal">{call.title}</a>
                    {call.resolution?.finalResolution && (
                      <p className="mt-0.5 text-muted">
                        {call.resolution.customerConfirmedFix ? "✓ Confirmed fix: " : "Resolution: "}
                        {call.resolution.finalResolution.slice(0, 120)}
                        {call.resolution.finalResolution.length > 120 ? "…" : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </ContextSection>
          )}

          {c.documents.length > 0 && (
            <ContextSection title="Customer documents">
              <ul className="space-y-1 text-xs text-gray-300">
                {c.documents.map((d) => (
                  <li key={d.id}>
                    📄 {d.title}
                    {d.documentType && <span className="text-muted"> · {d.documentType}</span>}
                  </li>
                ))}
              </ul>
            </ContextSection>
          )}
        </div>
      )}
    </section>
  );
}

function ContextSection(props: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{props.title}</h3>
      {props.children}
    </div>
  );
}

function ContextSearch(props: { customerId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch("/api/context-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, customerId: props.customerId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Search failed.");
      setResults((await res.json()).results as SearchResult[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="rounded-md border border-line bg-surface-2 p-2.5">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void run();
            }
          }}
          placeholder="Search knowledge base…"
          aria-label="Search knowledge base"
          className="min-w-0 flex-1 rounded-md border border-line bg-surface-3 px-2.5 py-1.5 text-xs text-white placeholder:text-muted focus:border-signal focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void run()}
          disabled={!query.trim() || searching}
          className="rounded-md border border-line bg-surface-3 px-2.5 py-1.5 text-xs text-gray-100 hover:border-signal disabled:opacity-40"
        >
          {searching ? <Spinner className="h-3 w-3" /> : "Search"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {results !== null && (
        <div className="mt-2 space-y-1.5">
          {results.length === 0 && <p className="text-xs italic text-muted">No matching passages found.</p>}
          {results.map((r, i) => (
            <div key={i} className="rounded-md bg-surface-3 px-2.5 py-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-100">{r.title}</span>
                <Badge tone={r.tier === "customer" ? "signal" : "neutral"}>{r.tier}</Badge>
              </div>
              {r.section && <p className="text-muted">{r.section}</p>}
              <p className="mt-1 text-gray-300">{r.snippet}…</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
