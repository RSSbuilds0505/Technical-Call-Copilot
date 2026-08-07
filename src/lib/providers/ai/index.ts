import { env } from "@/lib/env";
import type { AIProvider } from "./types";
import { AnthropicProvider } from "./anthropic";
import { MockAIProvider } from "./mock";

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;
  cached = env.AI_PROVIDER === "anthropic" ? new AnthropicProvider() : new MockAIProvider();
  return cached;
}

export type { AIProvider } from "./types";
