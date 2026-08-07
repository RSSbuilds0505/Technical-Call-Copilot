"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, ErrorNote, Spinner } from "@/components/ui";

type Role = "ADMIN" | "MANAGER" | "SPECIALIST" | "READ_ONLY";

interface Member {
  userId: string;
  name: string;
  email: string;
  role: Role;
  isSelf: boolean;
}

interface IntegrationRow {
  provider: string;
  implemented: boolean;
  connection: { provider: string; displayName: string; status: string; readOnly: boolean; credentialHint: string | null } | null;
}

const ROLES: Role[] = ["ADMIN", "MANAGER", "SPECIALIST", "READ_ONLY"];

export function SettingsClient(props: {
  organizationName: string;
  role: Role;
  settings: Record<string, unknown>;
  members: Member[];
  integrations: IntegrationRow[];
  providers: { ai: string; embeddings: string; transcription: string; storage: string };
}) {
  const isAdmin = props.role === "ADMIN";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Organization configuration, team, and connected tools.
          {!isAdmin && " You have manager access: some actions are admin-only."}
        </p>
      </header>

      <OrgSection organizationName={props.organizationName} settings={props.settings} isAdmin={isAdmin} />
      <UsersSection members={props.members} isAdmin={isAdmin} />
      <IntegrationsSection integrations={props.integrations} isAdmin={isAdmin} />
      <ProvidersSection providers={props.providers} />
      <DataSection isAdmin={isAdmin} />
    </div>
  );
}

function OrgSection(props: { organizationName: string; settings: Record<string, unknown>; isAdmin: boolean }) {
  const [name, setName] = useState(props.organizationName);
  const [retention, setRetention] = useState(String(props.settings.dataRetentionDays ?? 365));
  const [consentText, setConsentText] = useState(String(props.settings.recordingConsentText ?? "This call may be transcribed to assist our team. Do we have your consent to proceed?"));
  const [autoPublish, setAutoPublish] = useState(props.settings.kbAutoPublishResolvedCases !== false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/settings/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        settings: {
          dataRetentionDays: Number(retention) || 365,
          recordingConsentText: consentText,
          kbAutoPublishResolvedCases: autoPublish,
        },
      }),
    });
    if (res.ok) setSaved(true);
    else setError((await res.json()).error ?? "Could not save settings.");
    setSaving(false);
  }

  return (
    <Card title="Organization">
      <div className="space-y-3">
        <FieldRow label="Organization name">
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={!props.isAdmin} className={inputCls} />
        </FieldRow>
        <FieldRow label="Data retention (days)" hint="How long transcripts and recordings are kept before eligible for deletion">
          <input value={retention} onChange={(e) => setRetention(e.target.value.replace(/\D/g, ""))} disabled={!props.isAdmin} inputMode="numeric" className={inputCls} />
        </FieldRow>
        <FieldRow label="Consent prompt" hint="Shown to specialists on the pre-call consent gate">
          <textarea value={consentText} onChange={(e) => setConsentText(e.target.value)} disabled={!props.isAdmin} rows={2} className={inputCls} />
        </FieldRow>
        <label className="flex items-center gap-2 text-sm text-gray-200">
          <input type="checkbox" checked={autoPublish} onChange={(e) => setAutoPublish(e.target.checked)} disabled={!props.isAdmin} className="h-4 w-4 accent-[#57B8FF]" />
          Publish confirmed resolutions to the knowledge base automatically
        </label>
        {error && <ErrorNote message={error} />}
        {props.isAdmin && (
          <div className="flex items-center gap-3">
            <Button onClick={() => void save()} disabled={saving}>{saving ? <Spinner className="h-3.5 w-3.5" /> : "Save"}</Button>
            {saved && <span className="text-xs text-ok">Saved</span>}
          </div>
        )}
      </div>
    </Card>
  );
}

function UsersSection(props: { members: Member[]; isAdmin: boolean }) {
  const router = useRouter();
  const [invite, setInvite] = useState({ name: "", email: "", role: "SPECIALIST" as Role, temporaryPassword: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitInvite() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/settings/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invite),
    });
    if (res.ok) {
      setInvite({ name: "", email: "", role: "SPECIALIST", temporaryPassword: "" });
      router.refresh();
    } else {
      setError((await res.json()).error ?? "Invite failed.");
    }
    setBusy(false);
  }

  async function changeRole(userId: string, role: Role) {
    setError(null);
    const res = await fetch("/api/settings/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    if (res.ok) router.refresh();
    else setError((await res.json()).error ?? "Role change failed.");
  }

  return (
    <Card title="Team" subtitle="Roles are enforced server-side on every request">
      <ul className="mb-4 space-y-2">
        {props.members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-2 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm text-white">{m.name}{m.isSelf && <span className="text-muted"> (you)</span>}</p>
              <p className="truncate text-xs text-muted">{m.email}</p>
            </div>
            {props.isAdmin && !m.isSelf ? (
              <select value={m.role} onChange={(e) => void changeRole(m.userId, e.target.value as Role)} className="rounded-md border border-line bg-surface-3 px-2 py-1 text-xs text-gray-100">
                {ROLES.map((r) => <option key={r} value={r}>{r.toLowerCase().replace("_", "-")}</option>)}
              </select>
            ) : (
              <Badge tone="neutral">{m.role.toLowerCase().replace("_", "-")}</Badge>
            )}
          </li>
        ))}
      </ul>

      {props.isAdmin && (
        <div className="rounded-md border border-line bg-surface-2 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Invite a teammate</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input placeholder="Full name" value={invite.name} onChange={(e) => setInvite((v) => ({ ...v, name: e.target.value }))} className={inputCls} />
            <input placeholder="Email" type="email" value={invite.email} onChange={(e) => setInvite((v) => ({ ...v, email: e.target.value }))} className={inputCls} />
            <select value={invite.role} onChange={(e) => setInvite((v) => ({ ...v, role: e.target.value as Role }))} className={inputCls}>
              {ROLES.map((r) => <option key={r} value={r}>{r.toLowerCase().replace("_", "-")}</option>)}
            </select>
            <input placeholder="Temporary password (10+ chars)" value={invite.temporaryPassword} onChange={(e) => setInvite((v) => ({ ...v, temporaryPassword: e.target.value }))} className={inputCls} />
          </div>
          <p className="mt-2 text-[11px] text-muted">MVP invite flow: share the temporary password with them directly. They can reset it from the login page.</p>
          <div className="mt-2">
            <Button onClick={() => void submitInvite()} disabled={busy || !invite.name || !invite.email || invite.temporaryPassword.length < 10}>
              {busy ? <Spinner className="h-3.5 w-3.5" /> : "Invite"}
            </Button>
          </div>
        </div>
      )}
      {error && <div className="mt-3"><ErrorNote message={error} /></div>}
    </Card>
  );
}

function IntegrationsSection(props: { integrations: IntegrationRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [credential, setCredential] = useState("");
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function connect(provider: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/settings/integrations/${provider}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    const data = await res.json();
    if (res.ok) {
      setConnecting(null);
      setCredential("");
      router.refresh();
    } else {
      setError(data.error ?? "Connection failed.");
    }
    setBusy(false);
  }

  async function disconnect(provider: string) {
    setError(null);
    const res = await fetch(`/api/settings/integrations/${provider}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setError((await res.json()).error ?? "Disconnect failed.");
  }

  async function testSearch(provider: string) {
    setError(null);
    setTestResult(null);
    const res = await fetch(`/api/settings/integrations/${provider}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "" }),
    });
    const data = await res.json();
    if (res.ok) setTestResult(`${provider}: read-only search returned ${data.records.length} record${data.records.length === 1 ? "" : "s"}.`);
    else setError(data.error ?? "Test failed.");
  }

  return (
    <Card title="Connected tools" subtitle="All connectors are read-only. Credentials are encrypted at rest and never displayed again after saving.">
      <ul className="space-y-2">
        {props.integrations.map((row) => (
          <li key={row.provider} className="rounded-md bg-surface-2 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm capitalize text-white">{row.provider}</span>
                {!row.implemented && <Badge tone="neutral">planned</Badge>}
                {row.connection && <Badge tone="ok">connected</Badge>}
                {row.connection?.readOnly && <Badge tone="signal">read-only</Badge>}
                {row.connection?.credentialHint && <span className="text-xs text-muted">key {row.connection.credentialHint}</span>}
              </div>
              {props.isAdmin && row.implemented && (
                <div className="flex gap-2">
                  {row.connection ? (
                    <>
                      <Button variant="ghost" onClick={() => void testSearch(row.provider)}>Test</Button>
                      <Button variant="ghost" onClick={() => void disconnect(row.provider)}>Disconnect</Button>
                    </>
                  ) : (
                    <Button variant="ghost" onClick={() => { setConnecting(connecting === row.provider ? null : row.provider); setCredential(""); }}>
                      Connect
                    </Button>
                  )}
                </div>
              )}
            </div>
            {connecting === row.provider && (
              <div className="mt-2 flex gap-2">
                <input
                  type="password"
                  placeholder={row.provider === "hubspot" ? "HubSpot private app token (pat-...)" : "Credential"}
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  className={inputCls + " flex-1"}
                />
                <Button onClick={() => void connect(row.provider)} disabled={busy || credential.length < 4}>
                  {busy ? <Spinner className="h-3.5 w-3.5" /> : "Verify + save"}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {testResult && <p className="mt-3 text-xs text-ok">{testResult}</p>}
      {error && <div className="mt-3"><ErrorNote message={error} /></div>}
    </Card>
  );
}

function ProvidersSection(props: { providers: { ai: string; embeddings: string; transcription: string; storage: string } }) {
  const rows = [
    { label: "AI provider", value: props.providers.ai, note: props.providers.ai === "mock" ? "deterministic offline mode, set ANTHROPIC_API_KEY for live guidance" : null },
    { label: "Embeddings", value: props.providers.embeddings, note: props.providers.embeddings === "local" ? "hashed n-gram fallback, set OPENAI_API_KEY for semantic embeddings" : null },
    { label: "Transcription", value: props.providers.transcription, note: props.providers.transcription === "simulated" ? "manual and simulated transcript entry" : null },
    { label: "Storage", value: props.providers.storage, note: null },
  ];
  return (
    <Card title="Runtime providers" subtitle="Configured via environment variables, shown here for transparency">
      <ul className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2">
            <span className="text-muted">{r.label}</span>
            <span className="text-right">
              <Badge tone="signal">{r.value}</Badge>
              {r.note && <span className="ml-2 text-[11px] text-muted">{r.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DataSection(props: { isAdmin: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteOrg() {
    setError(null);
    const res = await fetch("/api/settings/org", { method: "DELETE" });
    if (res.ok) {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } else {
      setError((await res.json()).error ?? "Delete failed.");
    }
  }

  return (
    <Card title="Data" subtitle="Export everything, or delete the organization">
      <div className="flex flex-wrap items-center gap-3">
        <a href="/api/settings/export" className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-gray-100 hover:border-signal">
          Export organization data (JSON)
        </a>
        {props.isAdmin && !confirming && (
          <Button variant="ghost" className="text-danger" onClick={() => setConfirming(true)}>Delete organization…</Button>
        )}
        {props.isAdmin && confirming && (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-danger">This soft-deletes the organization and signs everyone out. Are you sure?</span>
            <Button variant="ghost" className="text-danger" onClick={() => void deleteOrg()}>Yes, delete</Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          </span>
        )}
      </div>
      {error && <div className="mt-3"><ErrorNote message={error} /></div>}
    </Card>
  );
}

function FieldRow(props: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{props.label}</label>
      {props.children}
      {props.hint && <p className="mt-1 text-[11px] text-muted">{props.hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-gray-100 placeholder:text-muted focus:border-signal focus:outline-none disabled:opacity-60";
