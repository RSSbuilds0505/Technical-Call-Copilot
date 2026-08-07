"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, ErrorNote, Spinner } from "@/components/ui";
import { CopyButton } from "@/components/ui/CopyButton";
import type { PostCallContent } from "@/lib/schemas/recommendation";

interface ResolutionForm {
  finalIssueSummary: string | null;
  confirmedRootCause: string | null;
  finalResolution: string | null;
  customerConfirmedFix: boolean;
  followUpRequired: boolean;
  engineeringEscalation: boolean;
  docsToUpdate: string | null;
}

const EMPTY_RESOLUTION: ResolutionForm = {
  finalIssueSummary: "",
  confirmedRootCause: "",
  finalResolution: "",
  customerConfirmedFix: false,
  followUpRequired: false,
  engineeringEscalation: false,
  docsToUpdate: "",
};

/** Long-form copyable text sections rendered as editable textareas. */
const TEXT_SECTIONS: { key: keyof PostCallContent; label: string; hint: string }[] = [
  { key: "crmNote", label: "CRM note", hint: "Paste into HubSpot or Salesforce activity log" },
  { key: "customerEmail", label: "Follow-up email to customer", hint: "Recap and next steps, customer-safe wording" },
  { key: "internalTechnicalNote", label: "Internal technical note", hint: "For your team, includes unconfirmed hypotheses" },
  { key: "supportTicket", label: "Support ticket", hint: "Ready to file in your support system" },
  { key: "engineeringTicket", label: "Engineering ticket", hint: "Only file if engineering work is actually needed" },
  { key: "escalationSummary", label: "Escalation summary", hint: "Hand-off context if this needs to go up a level" },
];

/** Read-only structured lists from the generated review. */
const LIST_SECTIONS: { key: keyof PostCallContent; label: string }[] = [
  { key: "customerQuestions", label: "Questions the customer asked" },
  { key: "issuesDiscussed", label: "Issues discussed" },
  { key: "confirmedFacts", label: "Confirmed facts" },
  { key: "assumptions", label: "Assumptions (unverified)" },
  { key: "likelyCauses", label: "Likely causes" },
  { key: "confirmedRootCauses", label: "Confirmed root causes" },
  { key: "troubleshootingCompleted", label: "Troubleshooting completed" },
  { key: "resolvedIssues", label: "Resolved" },
  { key: "unresolvedIssues", label: "Still open" },
  { key: "decisionsMade", label: "Decisions made" },
  { key: "customerCommitments", label: "Customer committed to" },
  { key: "internalCommitments", label: "We committed to" },
  { key: "followUpItems", label: "Follow-up items" },
];

export function ReviewClient(props: {
  callId: string;
  callTitle: string;
  callStatus: string;
  customerName: string | null;
  hasTranscript: boolean;
  initialReview: PostCallContent | null;
  initialResolution: ResolutionForm | null;
  readOnly: boolean;
}) {
  const [review, setReview] = useState<PostCallContent | null>(props.initialReview);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${props.callId}/review`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Review generation failed.");
      setReview((await res.json()).content as PostCallContent);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (!review) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/calls/${props.callId}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(review),
    });
    if (res.ok) setSavedAt(new Date());
    else setError((await res.json()).error ?? "Could not save your edits.");
    setSaving(false);
  }

  function setText(key: keyof PostCallContent, value: string) {
    setReview((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Post-call workspace</h1>
          <p className="mt-1 text-sm text-muted">
            {props.callTitle}
            {props.customerName && <> · {props.customerName}</>}
            {" · "}
            <Badge tone={props.callStatus === "ENDED" ? "neutral" : "ok"}>{props.callStatus.toLowerCase()}</Badge>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/calls/${props.callId}/live`} className="text-sm text-signal hover:underline">
            View transcript
          </Link>
          {!props.readOnly && (
            <Button onClick={() => void generate()} disabled={generating || !props.hasTranscript}>
              {generating ? <Spinner className="h-3.5 w-3.5" /> : review ? "Regenerate" : "Generate review"}
            </Button>
          )}
        </div>
      </header>

      {error && <ErrorNote message={error} />}
      {!props.hasTranscript && (
        <Card>
          <p className="text-sm text-muted">This call has no transcript yet, so there is nothing to review.</p>
        </Card>
      )}

      {!review && props.hasTranscript && !generating && (
        <Card>
          <p className="text-sm text-muted">
            Generate the post-call review to get a structured summary, a CRM-ready note, a customer follow-up email, and ticket drafts, all built from the actual transcript.
          </p>
        </Card>
      )}
      {generating && !review && (
        <Card>
          <p className="flex items-center gap-2 text-sm text-signal"><Spinner className="h-3.5 w-3.5" /> Reading the transcript and drafting your review…</p>
        </Card>
      )}

      {review && (
        <>
          <Card title="Executive summary" action={<CopyButton text={review.executiveSummary} />}>
            <EditableText value={review.executiveSummary} onChange={(v) => setText("executiveSummary", v)} readOnly={props.readOnly} rows={3} />
          </Card>
          <Card title="Technical summary" action={<CopyButton text={review.technicalSummary} />}>
            <EditableText value={review.technicalSummary} onChange={(v) => setText("technicalSummary", v)} readOnly={props.readOnly} rows={4} />
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {LIST_SECTIONS.map(({ key, label }) => {
              const items = review[key];
              if (!Array.isArray(items) || items.length === 0) return null;
              return (
                <Card key={key} title={label} action={<CopyButton text={items.map((i) => `- ${i}`).join("\n")} />}>
                  <ul className="space-y-1 text-sm text-gray-200">
                    {items.map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>

          {review.recommendedEscalation && (
            <Card title="Recommended escalation">
              <p className="text-sm text-warn">{review.recommendedEscalation}</p>
            </Card>
          )}

          {TEXT_SECTIONS.map(({ key, label, hint }) => {
            const value = review[key];
            if (typeof value !== "string" || !value.trim()) return null;
            return (
              <Card key={key} title={label} subtitle={hint} action={<CopyButton text={value} />}>
                <EditableText value={value} onChange={(v) => setText(key, v)} readOnly={props.readOnly} rows={8} />
              </Card>
            );
          })}

          {review.knowledgeBaseUpdate && (
            <Card title="Suggested knowledge base update" subtitle="A documentation gap this call surfaced" action={<CopyButton text={review.knowledgeBaseUpdate} />}>
              <EditableText value={review.knowledgeBaseUpdate} onChange={(v) => setText("knowledgeBaseUpdate", v)} readOnly={props.readOnly} rows={5} />
            </Card>
          )}

          {!props.readOnly && (
            <div className="flex items-center gap-3">
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? <Spinner className="h-3.5 w-3.5" /> : "Save edits"}
              </Button>
              {savedAt && <span className="text-xs text-ok">Saved {savedAt.toLocaleTimeString()}</span>}
            </div>
          )}
        </>
      )}

      <ResolutionSection callId={props.callId} initial={props.initialResolution} readOnly={props.readOnly} />
    </div>
  );
}

function EditableText(props: { value: string; onChange: (v: string) => void; readOnly: boolean; rows: number }) {
  if (props.readOnly) return <p className="whitespace-pre-wrap text-sm text-gray-200">{props.value}</p>;
  return (
    <textarea
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      rows={props.rows}
      className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-gray-100 focus:border-signal focus:outline-none"
    />
  );
}

function ResolutionSection(props: { callId: string; initial: ResolutionForm | null; readOnly: boolean }) {
  const [form, setForm] = useState<ResolutionForm>(props.initial ?? EMPTY_RESOLUTION);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/calls/${props.callId}/resolution`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) setSavedAt(new Date());
    else setError((await res.json()).error ?? "Could not save the resolution.");
    setSaving(false);
  }

  function field(key: "finalIssueSummary" | "confirmedRootCause" | "finalResolution" | "docsToUpdate", label: string, rows: number) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
        <textarea
          value={form[key] ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          disabled={props.readOnly}
          rows={rows}
          className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-gray-100 focus:border-signal focus:outline-none disabled:opacity-60"
        />
      </div>
    );
  }

  function toggle(key: "customerConfirmedFix" | "followUpRequired" | "engineeringEscalation", label: string) {
    return (
      <label className="flex items-center gap-2 text-sm text-gray-200">
        <input
          type="checkbox"
          checked={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
          disabled={props.readOnly}
          className="h-4 w-4 rounded border-line bg-surface-2 accent-[#57B8FF]"
        />
        {label}
      </label>
    );
  }

  return (
    <Card
      title="Final resolution"
      subtitle="Confirmed resolutions with a root cause feed the knowledge base and improve future guidance"
    >
      <div className="space-y-3">
        {field("finalIssueSummary", "What was the issue?", 2)}
        {field("confirmedRootCause", "Confirmed root cause", 2)}
        {field("finalResolution", "What actually fixed it?", 3)}
        {field("docsToUpdate", "Documentation to update", 2)}
        <div className="flex flex-wrap gap-4">
          {toggle("customerConfirmedFix", "Customer confirmed the fix")}
          {toggle("followUpRequired", "Follow-up required")}
          {toggle("engineeringEscalation", "Escalated to engineering")}
        </div>
        {error && <ErrorNote message={error} />}
        {!props.readOnly && (
          <div className="flex items-center gap-3">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Spinner className="h-3.5 w-3.5" /> : "Save resolution"}
            </Button>
            {savedAt && <span className="text-xs text-ok">Saved {savedAt.toLocaleTimeString()}</span>}
          </div>
        )}
      </div>
    </Card>
  );
}
