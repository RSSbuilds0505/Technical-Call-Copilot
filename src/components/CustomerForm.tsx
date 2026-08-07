"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorNote, Input, Label, Textarea } from "@/components/ui";

export interface CustomerFormValues {
  id?: string;
  name?: string;
  website?: string | null;
  industry?: string | null;
  description?: string | null;
  primaryProducts?: string[];
  crmPlatform?: string | null;
  subscriptionTier?: string | null;
  architectureNotes?: string | null;
  dataArchitectureNotes?: string | null;
  securityRequirements?: string | null;
  implementationPhase?: string | null;
  internalNotes?: string | null;
  customTerminology?: { term: string; meaning: string }[];
}

export function CustomerForm({ initial }: { initial?: CustomerFormValues }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    const terminologyRaw = String(data.get("customTerminology") ?? "").trim();
    const customTerminology = terminologyRaw
      ? terminologyRaw.split("\n").map((line) => {
          const [term, ...rest] = line.split(":");
          return { term: term.trim(), meaning: rest.join(":").trim() };
        }).filter((t) => t.term && t.meaning)
      : [];
    const body = {
      name: data.get("name"),
      website: data.get("website") || null,
      industry: data.get("industry") || null,
      description: data.get("description") || null,
      primaryProducts: String(data.get("primaryProducts") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      crmPlatform: data.get("crmPlatform") || null,
      subscriptionTier: data.get("subscriptionTier") || null,
      architectureNotes: data.get("architectureNotes") || null,
      dataArchitectureNotes: data.get("dataArchitectureNotes") || null,
      securityRequirements: data.get("securityRequirements") || null,
      implementationPhase: data.get("implementationPhase") || null,
      internalNotes: data.get("internalNotes") || null,
      customTerminology,
    };
    const res = await fetch(initial?.id ? `/api/customers/${initial.id}` : "/api/customers", {
      method: initial?.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = await res.json();
      router.push(`/customers/${json.customer.id}`);
      router.refresh();
    } else {
      setError((await res.json()).error ?? "Save failed.");
      setBusy(false);
    }
  }

  const terminologyText = (initial?.customTerminology ?? []).map((t) => `${t.term}: ${t.meaning}`).join("\n");

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <div><Label htmlFor="name">Customer name</Label><Input id="name" name="name" defaultValue={initial?.name ?? ""} required /></div>
        <div><Label htmlFor="website">Website</Label><Input id="website" name="website" defaultValue={initial?.website ?? ""} placeholder="https://" /></div>
        <div><Label htmlFor="industry">Industry</Label><Input id="industry" name="industry" defaultValue={initial?.industry ?? ""} /></div>
        <div><Label htmlFor="implementationPhase">Implementation phase</Label><Input id="implementationPhase" name="implementationPhase" defaultValue={initial?.implementationPhase ?? ""} placeholder="e.g. Pilot, Phase 2 build" /></div>
        <div><Label htmlFor="crmPlatform">CRM platform</Label><Input id="crmPlatform" name="crmPlatform" defaultValue={initial?.crmPlatform ?? ""} placeholder="e.g. HubSpot" /></div>
        <div><Label htmlFor="subscriptionTier">Subscription tier</Label><Input id="subscriptionTier" name="subscriptionTier" defaultValue={initial?.subscriptionTier ?? ""} placeholder="e.g. Marketing Hub Professional" /></div>
        <div className="md:col-span-2"><Label htmlFor="primaryProducts">Primary products (comma-separated)</Label><Input id="primaryProducts" name="primaryProducts" defaultValue={(initial?.primaryProducts ?? []).join(", ")} /></div>
        <div className="md:col-span-2"><Label htmlFor="description">Customer description</Label><Textarea id="description" name="description" rows={2} defaultValue={initial?.description ?? ""} /></div>
        <div className="md:col-span-2"><Label htmlFor="architectureNotes">Technical architecture notes</Label><Textarea id="architectureNotes" name="architectureNotes" rows={3} defaultValue={initial?.architectureNotes ?? ""} /></div>
        <div className="md:col-span-2"><Label htmlFor="dataArchitectureNotes">Data architecture notes</Label><Textarea id="dataArchitectureNotes" name="dataArchitectureNotes" rows={3} defaultValue={initial?.dataArchitectureNotes ?? ""} /></div>
        <div className="md:col-span-2"><Label htmlFor="securityRequirements">Security or compliance requirements</Label><Textarea id="securityRequirements" name="securityRequirements" rows={2} defaultValue={initial?.securityRequirements ?? ""} /></div>
        <div className="md:col-span-2"><Label htmlFor="customTerminology">Customer terminology (one per line: term: meaning)</Label><Textarea id="customTerminology" name="customTerminology" rows={2} defaultValue={terminologyText} placeholder="MQL+: their internal name for scored, sales-ready leads" /></div>
        <div className="md:col-span-2"><Label htmlFor="internalNotes">Internal notes</Label><Textarea id="internalNotes" name="internalNotes" rows={2} defaultValue={initial?.internalNotes ?? ""} /></div>
        <ErrorNote message={error} />
        <div className="md:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : initial?.id ? "Save changes" : "Create customer"}</Button></div>
      </form>
    </Card>
  );
}
