export interface AICompletionRequest {
  system: string;
  user: string;
  maxTokens?: number;
}

export interface AICompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: string;
}

/** Model-provider abstraction. Add providers by implementing this interface and registering in index.ts. */
export interface AIProvider {
  readonly name: string;
  complete(req: AICompletionRequest): Promise<AICompletionResult>;
}
