export interface TranscriptChunk {
  speakerLabel: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

/**
 * Streaming speech-to-text abstraction. The live workspace consumes TranscriptChunk
 * events regardless of vendor. Providers: simulated (always available), deepgram
 * (requires DEEPGRAM_API_KEY). Add AssemblyAI/OpenAI/Azure by implementing this interface.
 */
export interface TranscriptionProvider {
  readonly name: string;
  /** Whether this provider can accept live audio in the current environment. */
  isAvailable(): boolean;
  /**
   * Opens a streaming session. Audio is pushed via sendAudio; transcript chunks are
   * delivered via onChunk. Returns a handle to close the stream.
   */
  startStream(opts: {
    sampleRate: number;
    onChunk: (chunk: TranscriptChunk) => void;
    onError: (err: Error) => void;
  }): Promise<TranscriptionStreamHandle>;
}

export interface TranscriptionStreamHandle {
  sendAudio(data: ArrayBuffer): void;
  close(): Promise<void>;
}
