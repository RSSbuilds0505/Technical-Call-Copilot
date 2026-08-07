import { env } from "@/lib/env";
import type { EmbeddingProvider } from "./types";
import { LocalEmbeddingProvider } from "./local";
import { OpenAIEmbeddingProvider } from "./openai";

let cached: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (cached) return cached;
  cached = env.EMBEDDING_PROVIDER === "openai" ? new OpenAIEmbeddingProvider() : new LocalEmbeddingProvider();
  return cached;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
