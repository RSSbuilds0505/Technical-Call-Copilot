"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, ErrorNote, Input } from "@/components/ui";

interface Contact { id: string; name: string; title: string | null; email: string | null; isPrimary: boolean }
interface Technology { id: string; name: string; category: string | null }
interface Integration { id: string; sourceSystem: string; targetSystem: string; syncType: string | null; status: string | null }
interface Issue { id: string; title: string; status: string; severity: string }

export function CustomerSubEntities(props: {
  customerId: string;
  contacts: Contact[];
  technologies: Technology[];
  integrations: Integration[];
  issues: Issue[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function add(kind: "contacts" | "technologies" | "integrations" | "issues", body: Record<string, string>) {
    setError(null);
    const res = await fetch(`/api/customers/${props.customerId}/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) router.refresh();
    else setError((await res.json()).error ?? "Could not save.");
  }

  return (
    <section className="grid gap-3 md:grid-cols-2">
      <Card>
        <h2 className="mb-2 text-sm font-medium text-muted">Technology stack</h2>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {props.technologies.map((t) => <Badge key={t.id} tone="signal">{t.name}</Badge>)}
          {props.technologies.length === 0 && <p className="text-xs text-muted">Nothing recorded yet.</p>}
        </div>
        <QuickAdd placeholder="Add a tool, e.g. Apollo" onAdd={(v) => add("technologies", { name: v })} />
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-medium text-muted">Integrations</h2>
        <ul className="mb-2 space-y-1 text-sm">
          {props.integrations.map((i) => (
            <li key={i.id} className="flex items-center justify-between">
              <span>{i.sourceSystem} → {i.targetSystem}{i.syncType ? ` (${i.syncType})` : ""}</span>
              {i.status && <Badge tone={i.status === "active" ? "ok" : i.status === "broken" ? "danger" : "warn"}>{i.status}</Badge>}
            </li>
          ))}
          {props.integrations.length === 0 && <p className="text-xs text-muted">No integrations recorded.</p>}
        </ul>
        <QuickAdd placeholder="source > target, e.g. Apollo > HubSpot" onAdd={(v) => {
          const [source, target] = v.split(">").map((s) => s.trim());
          if (source && target) return add("integrations", { sourceSystem: source, targetSystem: target });
        }} />
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-medium text-muted">Known issues</h2>
        <ul className="mb-2 space-y-1 text-sm">
          {props.issues.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{i.title}</span>
              <Badge tone={i.status === "resolved" ? "ok" : i.severity === "high" ? "danger" : "warn"}>{i.status}</Badge>
            </li>
          ))}
          {props.issues.length === 0 && <p className="text-xs text-muted">No known issues logged.</p>}
        </ul>
        <QuickAdd placeholder="Describe a known issue" onAdd={(v) => add("issues", { title: v })} />
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-medium text-muted">Important contacts</h2>
        <ul className="mb-2 space-y-1 text-sm">
          {props.contacts.map((c) => (
            <li key={c.id}>{c.name}{c.title ? ` — ${c.title}` : ""}{c.isPrimary ? " (primary)" : ""}</li>
          ))}
          {props.contacts.length === 0 && <p className="text-xs text-muted">No contacts recorded.</p>}
        </ul>
        <QuickAdd placeholder="Name — Title" onAdd={(v) => {
          const [name, title] = v.split("—").map((s) => s.trim());
          return add("contacts", { name: name || v, ...(title ? { title } : {}) });
        }} />
      </Card>
      <ErrorNote message={error} />
    </section>
  );
}

function QuickAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (value: string) => void | Promise<void> }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key === "Enter" && value.trim()) {
            e.preventDefault();
            await onAdd(value.trim());
            setValue("");
          }
        }}
      />
      <Button variant="subtle" size="sm" onClick={async () => { if (value.trim()) { await onAdd(value.trim()); setValue(""); } }}>Add</Button>
    </div>
  );
}

export function CustomerDangerZone({ customerId, customerName }: { customerId: string; customerName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  return (
    <Card className="border-danger/30">
      <h2 className="text-sm font-medium text-danger">Delete this customer</h2>
      <p className="mt-1 text-xs text-muted">Removes {customerName} and hides its calls and documents from the workspace. Requires the manager role or higher.</p>
      {!confirming ? (
        <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirming(true)}>Delete customer…</Button>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button variant="danger" size="sm" onClick={async () => {
            const res = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
            if (res.ok) { router.push("/customers"); router.refresh(); }
          }}>Yes, delete {customerName}</Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      )}
    </Card>
  );
}
