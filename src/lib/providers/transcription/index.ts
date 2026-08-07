import { env } from "@/lib/env";
import type { TranscriptionProvider } from "./types";
import { SimulatedTranscriptionProvider } from "./simulated";
import { DeepgramTranscriptionProvider } from "./deepgram";

export function getTranscriptionProvider(): TranscriptionProvider {
  if (env.TRANSCRIPTION_PROVIDER === "deepgram") {
    const dg = new DeepgramTranscriptionProvider();
    if (dg.isAvailable()) return dg;
  }
  return new SimulatedTranscriptionProvider();
}

export function transcriptionMode(): "simulated" | "deepgram" {
  return getTranscriptionProvider().name as "simulated" | "deepgram";
}
