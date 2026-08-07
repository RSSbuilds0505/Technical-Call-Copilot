"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Live dictation via the browser's Web Speech API.
 *
 * Scope and limitations, stated plainly because they matter operationally:
 * - Chrome and Edge only. Safari's implementation is unreliable; Firefox has none.
 * - Captures the local microphone only. It cannot hear the far side of a Zoom or
 *   Meet call when the specialist is wearing headphones. Real dual-channel capture
 *   needs a streaming STT provider plus tab-audio capture.
 * - Chrome routes audio to a Google speech service. That is a third-party data flow
 *   distinct from the configured AI provider, and it should be disclosed to
 *   participants alongside the consent gate.
 * - Recognition auto-stops after silence; this hook restarts it until the caller
 *   explicitly stops, so a long call does not silently go deaf.
 */

interface SpeechRecognitionAlternativeLike { transcript: string; confidence: number }
interface SpeechRecognitionResultLike { isFinal: boolean; 0: SpeechRecognitionAlternativeLike; length: number }
interface SpeechRecognitionEventLike { resultIndex: number; results: { length: number; [i: number]: SpeechRecognitionResultLike } }
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type Ctor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface SpeechCapture {
  supported: boolean;
  listening: boolean;
  /** Text recognized but not yet finalized. Render as interim, never submit. */
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useSpeechCapture(opts: {
  /** Called once per finalized utterance. */
  onFinal: (text: string) => void;
  lang?: string;
  enabled?: boolean;
}): SpeechCapture {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRef = useRef(false);
  // Keep the latest callback without resubscribing the recognizer on every render.
  const onFinalRef = useRef(opts.onFinal);
  onFinalRef.current = opts.onFinal;

  useEffect(() => { setSupported(getRecognitionCtor() !== null); }, []);

  const build = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = opts.lang ?? "en-US";
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          const clean = text.trim();
          if (clean) onFinalRef.current(clean);
        } else {
          pending += text;
        }
      }
      setInterim(pending.trim());
    };

    rec.onerror = (e) => {
      // "no-speech" and "aborted" are routine during a call and should not alarm anyone.
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantRef.current = false;
        setListening(false);
        setError("Microphone access was blocked. Allow it in your browser's site settings, then start dictation again.");
        return;
      }
      setError(`Speech recognition error: ${e.error}`);
    };

    // Chrome ends the session after a silence window. Restart while the user still wants it on.
    rec.onend = () => {
      setInterim("");
      if (wantRef.current) {
        try { rec.start(); } catch { /* already starting; the next onend will retry */ }
      } else {
        setListening(false);
      }
    };

    return rec;
  }, [opts.lang]);

  const start = useCallback(() => {
    if (opts.enabled === false) return;
    setError(null);
    if (!recRef.current) recRef.current = build();
    const rec = recRef.current;
    if (!rec) { setError("This browser does not support live dictation. Chrome or Edge is required."); return; }
    wantRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      // start() throws if already running, which is harmless.
      setListening(true);
    }
  }, [build, opts.enabled]);

  const stop = useCallback(() => {
    wantRef.current = false;
    setInterim("");
    setListening(false);
    try { recRef.current?.stop(); } catch { /* not running */ }
  }, []);

  const toggle = useCallback(() => { (listening ? stop : start)(); }, [listening, start, stop]);

  // Release the microphone on unmount or when the session is no longer live.
  useEffect(() => {
    if (opts.enabled === false && wantRef.current) stop();
  }, [opts.enabled, stop]);

  useEffect(() => () => {
    wantRef.current = false;
    try { recRef.current?.abort(); } catch { /* nothing to abort */ }
  }, []);

  return { supported, listening, interim, error, start, stop, toggle };
}
