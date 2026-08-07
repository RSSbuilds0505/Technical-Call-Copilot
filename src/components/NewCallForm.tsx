"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorNote, Input, Label, Select, Textarea } from "@/components/ui";

const CALL_TYPES = [
  ["discovery", "Discovery"], ["demo", "Demo"], ["implementation", "Implementation"],
  ["troubleshooting", "Troubleshooting"], ["support", "Support"], ["architecture_review", "Architecture review"],
  ["customer_success", "Customer success"], ["escalation", "Escalation"], ["internal", "Internal technical call"], ["other", "Other"],
] as const;

const MEETING_PLATFORMS = ["Zoom", "Microsoft Teams", "Google Meet", "Phone", "Other"];

export function NewCallForm({ customers, defaultCustomerId, specialistName }: {
  customers: { id: string; name: string }[];
  defaultCustomerId?: string;
  specialistName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consent) {
      setError("Confirm that all participants have consented to transcription before starting.");
      return;
    }
    setBusy(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    const participantNames = String(data.get("participants") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const res = await fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: data.get("customerId") || null,
        title: data.get("title"),
        callType: data.get("callType"),
        meetingPlatform: data.get("meetingPlatform") || null,
        products: String(data.get("products") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
        objective: data.get("objective") || null,
        knownIssue: data.get("knownIssue") || null,
        participants: [
          { name: specialistName, roleType: "specialist" },
          ...participantNames.map((name) => ({ name, roleType: "customer" as const })),
        ],
        consentConfirmed: true,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      router.push(`/calls/${json.call.id}/live`);
    } else {
      setError((await res.json()).error ?? "Could not create the call.");
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2"><Label htmlFor="title">Call title</Label><Input id="title" name="title" placeholder="e.g. Apollo sync troubleshooting — Meridian Health" required /></div>
        <div>
          <Label htmlFor="customerId">Customer</Label>
          <Select id="customerId" name="customerId" defaultValue={defaultCustomerId ?? ""}>
            <option value="">No customer workspace</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="callType">Call type</Label>
          <Select id="callType" name="callType" defaultValue="troubleshooting" required>
            {CALL_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="meetingPlatform">Meeting platform</Label>
          <Select id="meetingPlatform" name="meetingPlatform" defaultValue="Zoom">
            {MEETING_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </div>
        <div><Label htmlFor="products">Products being discussed (comma-separated)</Label><Input id="products" name="products" placeholder="HubSpot, Apollo" /></div>
        <div className="md:col-span-2"><Label htmlFor="objective">Call objective</Label><Textarea id="objective" name="objective" rows={2} /></div>
        <div className="md:col-span-2"><Label htmlFor="knownIssue">Known issue going in (if any)</Label><Textarea id="knownIssue" name="knownIssue" rows={2} /></div>
        <div className="md:col-span-2"><Label htmlFor="participants">Participants (comma-separated names)</Label><Input id="participants" name="participants" placeholder="Jordan Reyes, Sam Whitfield" /></div>

        <div className="md:col-span-2 rounded-md border border-warn/40 bg-warn/5 p-3">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-signal" />
            <span>
              <span className="font-medium text-warn">Recording &amp; transcription consent</span>
              <span className="mt-0.5 block text-xs text-muted">I confirm that every participant on this call has been informed of, and consented to, live transcription in accordance with applicable law and company policy. Transcription cannot start without this confirmation.</span>
            </span>
          </label>
        </div>

        <ErrorNote message={error} />
        <div className="md:col-span-2">
          <Button type="submit" disabled={busy || !consent}>{busy ? "Creating…" : "Create call and open workspace"}</Button>
        </div>
      </form>
    </Card>
  );
}
