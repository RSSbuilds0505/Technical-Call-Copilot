import type { TranscriptionProvider, TranscriptionStreamHandle } from "./types";

/**
 * Simulated mode: no audio is processed. Transcript segments are created directly
 * via the transcript API from typed/pasted input in the live workspace.
 * This provider exists so the provider registry always resolves, and so the UI can
 * introspect which mode is active.
 */
export class SimulatedTranscriptionProvider implements TranscriptionProvider {
  readonly name = "simulated";
  isAvailable(): boolean { return true; }
  async startStream(): Promise<TranscriptionStreamHandle> {
    return { sendAudio: () => {}, close: async () => {} };
  }
}
