"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Input, Select, Textarea } from "@/components/ui";
import { cn, formatTime } from "@/lib/utils";
import { useSpeechCapture } from "@/lib/useSpeechCapture";

export interface Segment {
  id: string;
  speakerName: string;
  speakerRole: string;
  content: string;
  isInterim: boolean;
  isImportant: boolean;
  spokenAt: string;
}

const TECH_TERMS = /\b(webhook|api|sync|workflow|enrollment|field mapping|lifecycle stage|lead scoring|pipeline|integration|deduplicat\w*|attribution|oauth|token|endpoint|payload|automation|sequence|zapier|apollo|hubspot|salesforce|leadsquared|dynamics)\b/gi;

function highlight(text: string, isQuestion: boolean) {
  const parts = text.split(TECH_TERMS);
  return (
    <span className={cn(isQuestion && "text-signal")}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-signal/15 px-0.5 text-signal">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export function TranscriptPanel(props: {
  segments: Segment[];
  participants: { name: string; roleType: string }[];
  specialistName: string;
  live: boolean;
  readOnly: boolean;
  onSubmit: (segment: { speakerName: string; speakerRole: string; content: string }) => Promise<void>;
  onUpdateSegment: (id: string, patch: { content?: string; isImportant?: boolean }) => Promise<void>;
  onAnalyzeSelection: (text: string) => void;
  onAnalyzeLast30: () => void;
}) {
  const [content, setContent] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const speakers = useMemo(() => {
    const names = new Map<string, string>();
    names.set(props.specialistName, "specialist");
    for (const p of props.participants) if (!names.has(p.name)) names.set(p.name, p.roleType);
    for (const s of props.segments) if (!names.has(s.speakerName)) names.set(s.speakerName, s.speakerRole);
    return [...names.entries()];
  }, [props.participants, props.segments, props.specialistName]);

  useEffect(() => {
    if (speakers.length > 0 && !speaker) {
      const customer = speakers.find(([, role]) => role === "customer");
      setSpeaker((customer ?? speakers[0])[0]);
    }
  }, [speakers, speaker]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [props.segments.length]);

  const finalSegments = props.segments.filter((s) => !s.isInterim);
  const interim = props.segments.filter((s) => s.isInterim);

  async function submit() {
    const text = content.trim();
    if (!text || !speaker) return;
    setSending(true);
    const role = speakers.find(([name]) => name === speaker)?.[1] ?? "customer";
    await props.onSubmit({ speakerName: speaker, speakerRole: role, content: text });
    setContent("");
    setSending(false);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectionText = finalSegments.filter((s) => selected.has(s.id)).map((s) => `${s.speakerName}: ${s.content}`).join("\n");

  /**
   * Live dictation. Recognized speech is attributed to the specialist, since the
   * microphone only hears this side of the call. Utterances are queued into the
   * composer rather than auto-submitted, so a misheard phrase can be corrected
   * before it reaches the copilot.
   */
  const [dictateTarget, setDictateTarget] = useState<"composer" | "auto">("composer");
  const dictateTargetRef = useRef(dictateTarget);
  dictateTargetRef.current = dictateTarget;

  const speech = useSpeechCapture({
    enabled: props.live && !props.readOnly,
    onFinal: (text) => {
      if (dictateTargetRef.current === "auto") {
        void props.onSubmit({ speakerName: props.specialistName, speakerRole: "specialist", content: text });
      } else {
        setContent((prev) => (prev ? `${prev} ${text}` : text));
      }
    },
  });

  /** Space bar push-to-talk is unusable while typing, so use a modifier chord instead. */
  useEffect(() => {
    if (!props.live || props.readOnly) return;
    function onKey(e: KeyboardEvent) {
      // Ctrl/Cmd + Shift + D toggles dictation from anywhere on the page.
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        speech.toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.live, props.readOnly, speech]);

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-line bg-surface-1" aria-label="Live transcript">
      <header className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Transcript</h2>
        <div className="flex gap-1.5">
          {!props.readOnly && (
            <>
              <Button variant="ghost" size="sm" onClick={props.onAnalyzeLast30} disabled={!props.live && finalSegments.length === 0}>Analyze last 30s</Button>
              {selected.size > 0 && (
                <Button size="sm" onClick={() => { props.onAnalyzeSelection(selectionText); setSelected(new Set()); }}>
                  Analyze {selected.size} selected
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 scroll-slim">
        {finalSegments.length === 0 && interim.length === 0 && (
          <p className="py-8 text-center text-xs text-muted">
            {props.live ? "Add the first transcript message below, or paste what the customer just said." : "Start the session to begin transcription."}
          </p>
        )}
        {finalSegments.map((s) => {
          const isQuestion = s.speakerRole === "customer" && s.content.includes("?");
          return (
            <article key={s.id} className={cn("group rounded-md border px-2.5 py-2", s.isImportant ? "border-warn/40 bg-warn/5" : "border-transparent hover:border-line", selected.has(s.id) && "border-signal/60 bg-signal/5")}>
              <div className="mb-0.5 flex items-center gap-2 text-[11px] text-muted">
                <button
                  className="font-medium text-slate-300 hover:text-signal"
                  onClick={() => toggleSelect(s.id)}
                  title="Select for analysis"
                >
                  {s.speakerName}
                </button>
                <Badge tone={s.speakerRole === "customer" ? "signal" : "default"}>{s.speakerRole}</Badge>
                <span className="tabular-nums">{formatTime(s.spokenAt)}</span>
                {!props.readOnly && (
                  <span className="ml-auto hidden gap-1 group-hover:flex">
                    <button className="text-muted hover:text-warn" title={s.isImportant ? "Unmark important" : "Mark important"} onClick={() => void props.onUpdateSegment(s.id, { isImportant: !s.isImportant })}>★</button>
                    <button className="text-muted hover:text-signal" title="Correct text" onClick={() => { setEditing(s.id); setEditText(s.content); }}>✎</button>
                  </span>
                )}
              </div>
              {editing === s.id ? (
                <div className="space-y-1.5">
                  <Textarea rows={2} value={editText} onChange={(e) => setEditText(e.target.value)} />
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={async () => { await props.onUpdateSegment(s.id, { content: editText }); setEditing(null); }}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed">{highlight(s.content, isQuestion)}</p>
              )}
            </article>
          );
        })}
        {interim.map((s) => (
          <p key={s.id} className="px-2.5 text-sm italic text-muted" aria-live="polite">
            {s.speakerName}: {s.content} <span className="text-[10px] uppercase">(interim)</span>
          </p>
        ))}
      </div>

      {!props.readOnly && (
        <footer className="border-t border-line p-3">
          {/* Live dictation controls */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={speech.listening ? "danger" : "ghost"}
              onClick={speech.toggle}
              disabled={!props.live || !speech.supported}
              title={speech.supported ? "Ctrl/Cmd + Shift + D" : "Live dictation requires Chrome or Edge"}
            >
              <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full", speech.listening ? "animate-pulse bg-danger" : "bg-muted")} />
              {speech.listening ? "Stop dictation" : "Dictate"}
            </Button>
            {speech.listening && (
              <Select
                value={dictateTarget}
                onChange={(e) => setDictateTarget(e.target.value as "composer" | "auto")}
                className="w-44"
                aria-label="Where dictated speech goes"
              >
                <option value="composer">Review before sending</option>
                <option value="auto">Send automatically</option>
              </Select>
            )}
            {!speech.supported && (
              <span className="text-[11px] text-muted">Dictation needs Chrome or Edge. Typing and paste work everywhere.</span>
            )}
            {speech.listening && (
              <span className="text-[11px] text-muted">Your mic only. Paste the customer&rsquo;s words below.</span>
            )}
          </div>
          {speech.error && <p className="mb-2 text-[11px] text-danger" role="alert">{speech.error}</p>}
          {speech.listening && speech.interim && (
            <p className="mb-2 rounded-md bg-surface-2 px-2.5 py-1.5 text-sm italic text-muted" aria-live="polite">
              {speech.interim}
            </p>
          )}

          <div className="mb-2 flex gap-2">
            <Select value={speaker} onChange={(e) => setSpeaker(e.target.value)} className="w-40" aria-label="Speaker">
              {speakers.map(([name, role]) => <option key={name} value={name}>{name} ({role})</option>)}
            </Select>
            <Input
              placeholder="Add a speaker…"
              className="w-32"
              onKeyDown={(e) => {
                const value = (e.target as HTMLInputElement).value.trim();
                if (e.key === "Enter" && value) {
                  e.preventDefault();
                  props.participants.push({ name: value, roleType: "customer" });
                  setSpeaker(value);
                  (e.target as HTMLInputElement).value = "";
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <Textarea
              rows={2}
              placeholder={props.live ? "Type or paste what was just said, then press Enter…" : "Start the session to add transcript."}
              value={content}
              disabled={!props.live || sending}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            <Button onClick={() => void submit()} disabled={!props.live || sending || !content.trim()} className="self-end">
              {sending ? "…" : "Add"}
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted">Enter to send · Shift+Enter for a new line · click a speaker name to select segments for analysis</p>
        </footer>
      )}
    </section>
  );
}
