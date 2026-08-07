import { createHash } from "crypto";
import type { EmbeddingProvider } from "./types";

/**
 * Deterministic local embedding: hashed uni/bi-gram buckets + L2 normalization.
 * Not semantically deep, but gives stable lexical-overlap ranking so retrieval,
 * filtering, and citations work end-to-end without external credentials.
 * Swap to the OpenAI provider for production-quality semantic retrieval.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = "local";
  readonly dimensions = 384;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedOne(t));
  }

  private embedOne(text: string): number[] {
    const vec = new Array<number>(this.dimensions).fill(0);
    const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 1);
    for (let i = 0; i < tokens.length; i++) {
      const grams = [tokens[i]];
      if (i + 1 < tokens.length) grams.push(tokens[i] + "_" + tokens[i + 1]);
      for (const g of grams) {
        const h = createHash("md5").update(g).digest();
        const idx = h.readUInt32BE(0) % this.dimensions;
        const sign = h[4] % 2 === 0 ? 1 : -1;
        vec[idx] += sign;
      }
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}
