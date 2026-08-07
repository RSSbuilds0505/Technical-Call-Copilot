import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import type { AICompletionRequest, AICompletionResult, AIProvider } from "./types";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  async complete(req: AICompletionRequest): Promise<AICompletionResult> {
    const res = await this.client.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: req.maxTokens ?? 2000,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return {
      text,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      model: env.ANTHROPIC_MODEL,
      provider: this.name,
    };
  }
}
