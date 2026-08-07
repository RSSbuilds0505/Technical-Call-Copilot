import { env } from "@/lib/env";
import type { TranscriptChunk, TranscriptionProvider, TranscriptionStreamHandle } from "./types";

/**
 * Deepgram live-streaming adapter over the raw WebSocket API (no SDK dependency).
 * Audio is relayed server-side so the API key never reaches the browser.
 * NOTE: implemented against Deepgram's documented listen/v1 protocol but not yet
 * verified with live credentials; simulated mode remains the tested default.
 */
export class DeepgramTranscriptionProvider implements TranscriptionProvider {
  readonly name = "deepgram";

  isAvailable(): boolean { return Boolean(env.DEEPGRAM_API_KEY); }

  async startStream(opts: {
    sampleRate: number;
    onChunk: (chunk: TranscriptChunk) => void;
    onError: (err: Error) => void;
  }): Promise<TranscriptionStreamHandle> {
    if (!this.isAvailable()) throw new Error("Deepgram API key not configured.");
    const url = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=${opts.sampleRate}&interim_results=true&diarize=true&punctuate=true`;
    const ws = new WebSocket(url, ["token", env.DEEPGRAM_API_KEY]);

    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener("error", () => reject(new Error("Could not connect to Deepgram.")), { once: true });
    });

    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        const alt = msg?.channel?.alternatives?.[0];
        if (!alt?.transcript) return;
        const speaker = alt.words?.[0]?.speaker;
        opts.onChunk({
          speakerLabel: speaker !== undefined ? `Speaker ${speaker + 1}` : "Speaker",
          text: alt.transcript,
          isFinal: Boolean(msg.is_final),
          timestamp: Date.now(),
        });
      } catch (err) {
        opts.onError(err instanceof Error ? err : new Error("Failed to parse transcription message."));
      }
    });
    ws.addEventListener("error", () => opts.onError(new Error("Transcription stream error.")));

    return {
      sendAudio: (data: ArrayBuffer) => { if (ws.readyState === WebSocket.OPEN) ws.send(data); },
      close: async () => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "CloseStream" }));
        ws.close();
      },
    };
  }
}
