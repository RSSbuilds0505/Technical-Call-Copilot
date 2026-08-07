"use client";

import { useMemo, useState } from "react";
import { Badge, ConfidenceBar, EmptyState, Spinner, riskTone } from "@/components/ui";
import { CopyButton } from "@/components/ui/CopyButton";

/** Shape produced by serializeRecommendation on the server and by /api/calls/[id]. */
export interface Rec {
  id: string;
  eventType: string;
  issueSummary: string;
  payload: RecPayload | null;
  confidence: number;
  riskLevel: string;
  triggerText: string | null;
  createdAt: string;
  sources: { id?: string; documentId: string | null; title: string; section: string | null; relevance: string | null }[];
  feedback?: { rating: string }[];
}

interface RecPayload {
  suggestedResponse?: string;
  clarifyingQuestions?: string[];
  possibleCauses?: { cause: string; likelihood: string; reasoningSummary: string; verificationStep: string }[];
  recommendedActions?: { action: string; riskLevel: string; requiresApproval: boolean }[];
  missingInformation?: string[];
  warnings?: string[];
  shouldEscalate?: boolean;
  escalationReason?: string | null;
}

const NO_SOURCE_MESSAGE = "No verified source was found in the connected knowledge base.";
const VISIBLE_LIMIT = 3;

const EVENT_LABELS: Record<string, string> = {
  technical_question: "Technical question",
  troubleshooting_issue: "Troubleshooting",
  customer_objection: "Objection",
  feature_request: "Feature request",
  architecture_question: "Architecture",
  integration_issue: "Integration issue",
  data_issue: "Data issue",
  workflow_issue: "Workflow issue",
  permissions_issue: "Permissions",
  subscription_limitation: "Subscription limit",
  security_compliance_question: "Security / compliance",
  escalation_request: "Escalation",
  non_technical: "Non-technical",
  insufficient_information: "Needs more info",
  integration_troubleshooting: "Integration troubleshooting",
};

const FEEDBACK_OPTIONS: { rating: string; label: string; title: string }[] = [
  { rating: "helpful", label: "👍", title: "Helpful" },
  { rating: "partially_helpful", label: "~", title: "Partially helpful" },
  { rating: "incorrect", label: "👎", title: "Incorrect" },
  { rating: "dismissed", label: "✕", title: "Dismiss" },
];

export function GuidancePanel(props: {
  recs: Rec[];
  thinking: boolean;
  readOnly: boolean;
  onAsk: (prompt: string) => void;
}) {
  const [showOlder, setShowOlder] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  // Newest first; dismissed cards drop out of the visible stack.
  const ordered = useMemo(() => [...props.recs].reverse(), [props.recs]);
  const visible = showOlder ? ordered : ordered.slice(0, VISIBLE_LIMIT);
  const hiddenCount = ordered.length - VISIBLE_LIMIT;

  function submitCustom() {
    const prompt = customPrompt.trim();
    if (!prompt) return;
    props.onAsk(prompt);
    setCustomPrompt("");
  }

  return (
    <section aria-label="Copilot guidance" className="flex min-h-0 flex-col rounded-lg border border-line bg-surface-1">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Copilot guidance</h2>
        {props.thinking && (
          <span className="flex items-center gap-2 text-xs text-signal">
            <Spinner className="h-3.5 w-3.5" /> analyzing…
          </span>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto scroll-slim p-3">
        {visible.length === 0 && !props.thinking && (
          <EmptyState
            title="No guidance yet"
            hint="Guidance cards appear here when the copilot detects a technical question or issue in the transcript, or when you use a quick action."
          />
        )}
        {visible.map((rec, i) => (
          <RecommendationCard key={rec.id} rec={rec} expanded={i === 0} readOnly={props.readOnly} />
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowOlder((v) => !v)}
            className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-xs text-muted hover:text-white"
          >
            {showOlder ? "Collapse older guidance" : `Show ${hiddenCount} older card${hiddenCount === 1 ? "" : "s"}`}
          </button>
        )}
      </div>

      {!props.readOnly && (
        <footer className="border-t border-line p-3">
          <div className="flex gap-2">
            <input
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitCustom();
                }
              }}
              placeholder="Ask the copilot anything about this call…"
              aria-label="Custom copilot prompt"
              className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-signal focus:outline-none"
            />
            <button
              type="button"
              onClick={submitCustom}
              disabled={!customPrompt.trim() || props.thinking}
              className="rounded-md bg-signal px-3 py-2 text-sm font-medium text-surface-0 disabled:opacity-40"
            >
              Ask
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}

function RecommendationCard(props: { rec: Rec; expanded: boolean; readOnly: boolean }) {
  const { rec } = props;
  const [open, setOpen] = useState(props.expanded);
  const [sent, setSent] = useState<string | null>(rec.feedback?.[0]?.rating ?? null);
  const [sending, setSending] = useState(false);
  const p = rec.payload ?? {};

  async function sendFeedback(rating: string) {
    if (sending || sent) return;
    setSending(true);
    const res = await fetch(`/api/recommendations/${rec.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, usedOnCall: rating === "helpful" }),
    });
    if (res.ok) setSent(rating);
    setSending(false);
  }

  const hasVerifiedSources = rec.sources.some((s) => s.documentId !== null);

  return (
    <article className="rounded-lg border border-line bg-surface-2 p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-start justify-between gap-2 text-left">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge tone="signal">{EVENT_LABELS[rec.eventType] ?? rec.eventType}</Badge>
            <Badge tone={riskTone(rec.riskLevel)}>{rec.riskLevel} risk</Badge>
            {p.shouldEscalate && <Badge tone="danger">escalate</Badge>}
          </div>
          <p className="text-sm font-medium text-white">{rec.issueSummary}</p>
        </div>
        <span className="mt-1 shrink-0 text-xs text-muted">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-sm">
          {p.warnings && p.warnings.length > 0 && (
            <div className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
              {p.warnings.map((w, i) => (
                <p key={i}>⚠ {w}</p>
              ))}
            </div>
          )}

          {p.suggestedResponse && (
            <div>
              <SectionLabel label="Say this" extra={<CopyButton text={p.suggestedResponse} />} />
              <p className="whitespace-pre-wrap rounded-md bg-surface-3 px-3 py-2 text-gray-100">{p.suggestedResponse}</p>
            </div>
          )}

          {p.clarifyingQuestions && p.clarifyingQuestions.length > 0 && (
            <div>
              <SectionLabel label="Ask next" />
              <ul className="space-y-1">
                {p.clarifyingQuestions.map((q, i) => (
                  <li key={i} className="text-signal">• {q}</li>
                ))}
              </ul>
            </div>
          )}

          {p.possibleCauses && p.possibleCauses.length > 0 && (
            <div>
              <SectionLabel label="Possible causes" />
              <ul className="space-y-2">
                {p.possibleCauses.map((c, i) => (
                  <li key={i} className="rounded-md bg-surface-3 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-gray-100">{c.cause}</span>
                      <Badge tone={c.likelihood === "high" ? "ok" : c.likelihood === "medium" ? "warn" : "neutral"}>{c.likelihood}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">{c.reasoningSummary}</p>
                    <p className="mt-1 text-xs text-gray-300"><span className="text-muted">Verify:</span> {c.verificationStep}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p.recommendedActions && p.recommendedActions.length > 0 && (
            <div>
              <SectionLabel label="Recommended actions" />
              <ul className="space-y-1.5">
                {p.recommendedActions.map((a, i) => (
                  <li key={i} className="flex items-start justify-between gap-2 rounded-md bg-surface-3 px-3 py-2">
                    <span className="text-gray-100">{a.action}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Badge tone={riskTone(a.riskLevel)}>{a.riskLevel}</Badge>
                      {a.requiresApproval && <Badge tone="warn">approval</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-muted">High-risk actions are advisory only and are never executed by the copilot.</p>
            </div>
          )}

          {p.missingInformation && p.missingInformation.length > 0 && (
            <div>
              <SectionLabel label="Still missing" />
              <ul className="space-y-1 text-xs text-muted">
                {p.missingInformation.map((m, i) => (
                  <li key={i}>• {m}</li>
                ))}
              </ul>
            </div>
          )}

          {p.shouldEscalate && p.escalationReason && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">Escalate: {p.escalationReason}</p>
          )}

          <div>
            <SectionLabel label="Confidence" />
            <ConfidenceBar value={rec.confidence} />
          </div>

          <div>
            <SectionLabel label="Sources" />
            {hasVerifiedSources ? (
              <ul className="space-y-1 text-xs">
                {rec.sources.map((s, i) => (
                  <li key={i} className="text-gray-300">
                    📄 {s.title}
                    {s.section && <span className="text-muted"> · {s.section}</span>}
                    {s.relevance && <span className="text-muted"> — {s.relevance}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs italic text-muted">{NO_SOURCE_MESSAGE}</p>
            )}
          </div>

          {!props.readOnly && (
            <div className="flex items-center gap-1.5 border-t border-line pt-2">
              <span className="mr-1 text-[11px] text-muted">{sent ? `Feedback: ${sent.replace(/_/g, " ")}` : "Was this useful?"}</span>
              {!sent &&
                FEEDBACK_OPTIONS.map((f) => (
                  <button
                    key={f.rating}
                    type="button"
                    title={f.title}
                    disabled={sending}
                    onClick={() => void sendFeedback(f.rating)}
                    className="rounded-md border border-line bg-surface-3 px-2 py-1 text-xs hover:border-signal disabled:opacity-40"
                  >
                    {f.label}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function SectionLabel(props: { label: string; extra?: React.ReactNode }) {
  return (
    <div className="mb-1 flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{props.label}</span>
      {props.extra}
    </div>
  );
}
