"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, ErrorNote } from "@/components/ui";
import { TranscriptPanel, type Segment } from "./TranscriptPanel";
import { GuidancePanel, type Rec } from "./GuidancePanel";
import { ContextPanel } from "./ContextPanel";

export interface LiveCall {
  id: string;
  title: string;
  callType: string;
  status: "DRAFT" | "LIVE" | "PAUSED" | "ENDED";
  objective: string | null;
  knownIssue: string | null;
  consentConfirmed: boolean;
  customer: CustomerContext | null;
  participants: { id: string; name: string; roleType: string }[];
  segments: Segment[];
  recommendations: Rec[];
}

export interface CustomerContext {
  id: string;
  name: string;
  description: string | null;
  crmPlatform: string | null;
  subscriptionTier: string | null;
  customTerminology: { term: string; meaning: string }[] | null;
  technologies: { id: string; name: string }[];
  integrations: { id: string; sourceSystem: string; targetSystem: string; syncType: string | null; status: string | null }[];
  issues: { id: string; title: string; severity: string }[];
  actionItems: { id: string; description: string }[];
  documents: { id: string; title: string; documentType: string | null }[];
  calls: { id: string; title: string; createdAt: string; resolution: { finalIssueSummary: string | null; finalResolution: string | null; customerConfirmedFix: boolean } | null }[];
}

const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: "What should I ask next?", prompt: "What are the highest-value clarifying questions I should ask next?" },
  { label: "Summarize the issue", prompt: "Summarize the issue being described so far." },
  { label: "Likely root causes", prompt: "Identify the most likely root causes of this issue." },
  { label: "Troubleshooting steps", prompt: "Give me read-only troubleshooting steps for this issue." },
  { label: "Customer-safe explanation", prompt: "Draft a customer-safe explanation of what's happening and what we'll do next." },
  { label: "Find documentation", prompt: "Find supporting documentation relevant to this issue." },
  { label: "What's missing?", prompt: "Identify what information is still missing to diagnose this confidently." },
  { label: "Should this escalate?", prompt: "Determine whether this issue should be escalated, and why or why not." },
  { label: "Internal technical note", prompt: "Create an internal technical note summarizing the current state of this issue." },
  { label: "Compare to past cases", prompt: "Compare this issue to previous resolved cases and note similarities." },
];

export function LiveWorkspace(props: {
  call: LiveCall;
  specialistName: string;
  transcriptionMode: "simulated" | "deepgram";
  readOnly: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(props.call.status);
  const [segments, setSegments] = useState<Segment[]>(props.call.segments);
  const [recs, setRecs] = useState<Rec[]>(props.call.recommendations);
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [ending, setEnding] = useState(false);
  const pendingRecs = useRef(0);

  // SSE subscription for transcript + recommendation updates.
  useEffect(() => {
    const es = new EventSource(`/api/calls/${props.call.id}/stream`);
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as { type: string; data: Record<string, unknown> };
        if (event.type === "segment") {
          setSegments((prev) => (prev.some((s) => s.id === event.data.id) ? prev : [...prev, event.data as unknown as Segment]));
        } else if (event.type === "recommendation") {
          pendingRecs.current = Math.max(0, pendingRecs.current - 1);
          if (pendingRecs.current === 0) setThinking(false);
          setRecs((prev) => (prev.some((r) => r.id === event.data.id) ? prev : [...prev, event.data as unknown as Rec]));
        } else if (event.type === "call_status") {
          setStatus(event.data.status as LiveCall["status"]);
        } else if (event.type === "error") {
          pendingRecs.current = 0;
          setThinking(false);
          setError(String(event.data.message ?? "The copilot hit an error."));
        }
      } catch {
        /* ignore malformed events */
      }
    };
    es.onerror = () => {
      /* EventSource auto-reconnects; nothing to do */
    };
    return () => es.close();
  }, [props.call.id]);

  const [consented, setConsented] = useState(props.call.consentConfirmed);

  const setCallStatus = useCallback(async (next: "LIVE" | "PAUSED" | "ENDED", withConsent?: boolean) => {
    setError(null);
    if (next === "ENDED") setEnding(true);
    const res = await fetch(`/api/calls/${props.call.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withConsent ? { status: next, consentConfirmed: true } : { status: next }),
    });
    if (res.ok) {
      setStatus(next);
      if (next === "ENDED") router.push(`/calls/${props.call.id}/review`);
    } else {
      setError((await res.json()).error ?? "Could not update the session.");
      setEnding(false);
    }
  }, [props.call.id, router]);

  const submitSegment = useCallback(async (segment: { speakerName: string; speakerRole: string; content: string }) => {
    setError(null);
    const res = await fetch(`/api/calls/${props.call.id}/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(segment),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not add the transcript message.");
      return;
    }
    const json = await res.json();
    if (json.detection?.triggered) {
      pendingRecs.current += 1;
      setThinking(true);
    }
  }, [props.call.id]);

  const analyze = useCallback(async (body: { mode: "last_30s" | "selection" | "custom"; selectionText?: string; prompt?: string }) => {
    setError(null);
    setThinking(true);
    const res = await fetch(`/api/calls/${props.call.id}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setThinking(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Analysis failed.");
      return;
    }
    const json = await res.json();
    setRecs((prev) => (prev.some((r) => r.id === json.recommendation.id) ? prev : [...prev, json.recommendation]));
  }, [props.call.id]);

  const updateSegment = useCallback(async (segmentId: string, patch: { content?: string; isImportant?: boolean }) => {
    const res = await fetch(`/api/calls/${props.call.id}/segments/${segmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const json = await res.json();
      setSegments((prev) => prev.map((s) => (s.id === segmentId ? { ...s, ...json.segment } : s)));
    }
  }, [props.call.id]);

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-3">
      {/* Header: call controls */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-1 px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">{props.call.title}</h1>
          <p className="text-xs text-muted">
            {props.call.customer?.name ?? "No customer"} · {props.call.callType.replace("_", " ")} ·{" "}
            <span className="text-signal">{props.transcriptionMode === "simulated" ? "Simulated transcript mode" : "Live transcription (Deepgram)"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={status === "LIVE" ? "ok" : status === "PAUSED" ? "warn" : "default"}>{status}</Badge>
          {!props.readOnly && (
            <>
              {status === "DRAFT" && props.call.consentConfirmed && (
                <Button size="sm" onClick={() => void setCallStatus("LIVE")}>Start session</Button>
              )}
              {status === "DRAFT" && !props.call.consentConfirmed && (
                <span className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-200">
                    <input
                      type="checkbox"
                      checked={consented}
                      onChange={(e) => setConsented(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[#57B8FF]"
                    />
                    Participants consent to transcription
                  </label>
                  <Button size="sm" disabled={!consented} title={consented ? undefined : "Confirm participant consent first"} onClick={() => void setCallStatus("LIVE", true)}>
                    Start session
                  </Button>
                </span>
              )}
              {status === "LIVE" && <Button size="sm" variant="subtle" onClick={() => void setCallStatus("PAUSED")}>Pause</Button>}
              {status === "PAUSED" && <Button size="sm" onClick={() => void setCallStatus("LIVE")}>Resume</Button>}
              {(status === "LIVE" || status === "PAUSED") && (
                <Button size="sm" variant="danger" onClick={() => void setCallStatus("ENDED")} disabled={ending}>
                  {ending ? "Ending…" : "End session"}
                </Button>
              )}
              {status === "ENDED" && <Button size="sm" onClick={() => router.push(`/calls/${props.call.id}/review`)}>Open review</Button>}
            </>
          )}
        </div>
      </header>

      <ErrorNote message={error} />

      {/* Quick actions */}
      {!props.readOnly && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scroll-slim" role="toolbar" aria-label="Copilot quick actions">
          {QUICK_ACTIONS.map((qa) => (
            <Button key={qa.label} variant="ghost" size="sm" className="shrink-0" disabled={thinking || status === "DRAFT"} onClick={() => void analyze({ mode: "custom", prompt: qa.prompt })}>
              {qa.label}
            </Button>
          ))}
        </div>
      )}

      {/* Three-panel workspace */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(320px,1.1fr)_minmax(380px,1.5fr)_minmax(280px,1fr)]">
        <TranscriptPanel
          segments={segments}
          participants={props.call.participants}
          specialistName={props.specialistName}
          live={status === "LIVE"}
          readOnly={props.readOnly}
          onSubmit={submitSegment}
          onUpdateSegment={updateSegment}
          onAnalyzeSelection={(text) => void analyze({ mode: "selection", selectionText: text })}
          onAnalyzeLast30={() => void analyze({ mode: "last_30s" })}
        />
        <GuidancePanel recs={recs} thinking={thinking} readOnly={props.readOnly} onAsk={(prompt) => void analyze({ mode: "custom", prompt })} />
        <ContextPanel customer={props.call.customer} />
      </div>
    </div>
  );
}
