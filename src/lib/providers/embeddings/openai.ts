import OpenAI from "openai";
import { env } from "@/lib/env";
import type { EmbeddingProvider } from "./types";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
  readonly dimensions = 1536;
  private client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  async embed(texts: string[]): Promise<number[][]> {
    const res = await this.client.embeddings.create({ model: "text-embedding-3-small", input: texts });
    return res.data.map((d) => d.embedding);
  }
}
