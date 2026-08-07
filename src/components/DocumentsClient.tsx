"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorNote, Input, Label, Select, Spinner } from "@/components/ui";
import { formatDate } from "@/lib/utils";

interface Doc {
  id: string;
  title: string;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  errorMessage: string | null;
  documentType: string | null;
  platform: string | null;
  createdAt: string;
  customer: { id: string; name: string } | null;
  _count: { chunks: number };
}

const PLATFORMS = ["hubspot", "salesforce", "leadsquared", "apollo", "zapier", "make", "dynamics", "api"];

export function DocumentsClient({ customers }: { customers: { id: string; name: string }[] }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filters, setFilters] = useState({ customerId: "", platform: "", documentType: "", q: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    const res = await fetch(`/api/documents?${params}`);
    if (res.ok) setDocs((await res.json()).documents);
    else setError("Could not load documents.");
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  // Poll while any document is still processing so status badges stay current.
  useEffect(() => {
    if (!docs?.some((d) => d.status === "PENDING" || d.status === "PROCESSING")) return;
    const t = setTimeout(() => void load(), 2500);
    return () => clearTimeout(t);
  }, [docs, load]);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Choose a file first."); return; }
    setUploading(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    data.set("file", file);
    const res = await fetch("/api/documents", { method: "POST", body: data });
    if (res.ok) {
      formRef.current?.reset();
      await load();
    } else {
      setError((await res.json()).error ?? "Upload failed.");
    }
    setUploading(false);
  }

  async function act(id: string, action: "delete" | "reprocess") {
    const res = await fetch(action === "delete" ? `/api/documents/${id}` : `/api/documents/${id}/reprocess`, {
      method: action === "delete" ? "DELETE" : "POST",
    });
    if (res.ok) await load();
    else setError((await res.json()).error ?? "Action failed.");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Knowledge base</h1>

      <Card>
        <h2 className="mb-3 text-sm font-medium text-muted">Upload a document</h2>
        <form ref={formRef} onSubmit={upload} className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label htmlFor="file">File (PDF, DOCX, TXT, MD, CSV — max 15 MB)</Label>
            <input ref={fileRef} id="file" name="file" type="file" accept=".pdf,.docx,.txt,.md,.csv" className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-3 file:px-3 file:py-2 file:text-sm file:text-slate-200" />
          </div>
          <div><Label htmlFor="title">Title (optional)</Label><Input id="title" name="title" /></div>
          <div>
            <Label htmlFor="customerId">Scope</Label>
            <Select id="customerId" name="customerId" defaultValue="">
              <option value="">Entire organization</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="platform">Platform (optional)</Label>
            <Select id="platform" name="platform" defaultValue="">
              <option value="">Any</option>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="documentType">Type (optional)</Label>
            <Select id="documentType" name="documentType" defaultValue="">
              <option value="">Unspecified</option>
              {["guide", "runbook", "architecture", "contract", "playbook", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div className="flex items-end"><Button type="submit" disabled={uploading}>{uploading ? "Uploading…" : "Upload"}</Button></div>
        </form>
      </Card>

      <Card>
        <div className="mb-3 grid gap-2 md:grid-cols-4">
          <Input placeholder="Search titles…" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          <Select value={filters.customerId} onChange={(e) => setFilters((f) => ({ ...f, customerId: e.target.value }))}>
            <option value="">All customers</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={filters.platform} onChange={(e) => setFilters((f) => ({ ...f, platform: e.target.value }))}>
            <option value="">All platforms</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select value={filters.documentType} onChange={(e) => setFilters((f) => ({ ...f, documentType: e.target.value }))}>
            <option value="">All types</option>
            {["guide", "runbook", "architecture", "playbook", "resolved-case", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
        <ErrorNote message={error} />
        {docs === null ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : docs.length === 0 ? (
          <EmptyState title="No documents match" hint="Upload runbooks, architecture docs, and platform guides so the copilot can cite verified sources on calls." />
        ) : (
          <ul className="divide-y divide-line">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.title}</p>
                  <p className="text-xs text-muted">
                    {d.customer?.name ?? "Org-wide"}{d.platform ? ` · ${d.platform}` : ""}{d.documentType ? ` · ${d.documentType}` : ""} · {d._count.chunks} chunks · {formatDate(d.createdAt)}
                  </p>
                  {d.status === "FAILED" && d.errorMessage && <p className="text-xs text-danger">{d.errorMessage}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={d.status === "READY" ? "ok" : d.status === "FAILED" ? "danger" : "warn"}>{d.status}</Badge>
                  {d.status === "FAILED" && <Button variant="ghost" size="sm" onClick={() => void act(d.id, "reprocess")}>Reprocess</Button>}
                  <Button variant="danger" size="sm" onClick={() => void act(d.id, "delete")}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
