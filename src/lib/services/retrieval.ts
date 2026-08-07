import { db } from "@/lib/db";
import { cosineSimilarity, getEmbeddingProvider } from "@/lib/providers/embeddings";

export interface RetrievedChunk {
  documentId: string;
  documentTitle: string;
  documentType: string | null;
  platform: string | null;
  customerId: string | null;
  section: string | null;
  page: number | null;
  content: string;
  score: number;
  tier: "customer" | "organization" | "resolved-case";
}

export interface RetrievalFilters {
  platform?: string | null;
  documentType?: string | null;
}

const CANDIDATE_LIMIT = 400;
const MIN_SCORE = 0.12;

/**
 * Retrieval pipeline with hard tenant isolation:
 * 1. Customer-specific chunks first, 2. org-wide chunks, 3. resolved cases,
 * 4. metadata filters, 5. rerank (similarity + tier boost + recency), 6. top-K.
 * Every query is filtered by organizationId at the database level — chunks
 * denormalize organizationId precisely so no join can leak across tenants.
 */
export async function retrieveContext(params: {
  organizationId: string;
  customerId?: string | null;
  query: string;
  filters?: RetrievalFilters;
  limit?: number;
}): Promise<RetrievedChunk[]> {
  const { organizationId, customerId, query } = params;
  const limit = params.limit ?? 6;
  if (!query.trim()) return [];

  const [queryEmbedding] = await getEmbeddingProvider().embed([query]);

  const docWhere: Record<string, unknown> = { status: "READY", deletedAt: null };
  if (params.filters?.platform) docWhere.platform = params.filters.platform;
  if (params.filters?.documentType) docWhere.documentType = params.filters.documentType;

  const chunks = await db.documentChunk.findMany({
    where: {
      organizationId, // hard tenant filter — applied before any ranking
      ...(customerId ? { OR: [{ customerId }, { customerId: null }] } : { customerId: null }),
      document: docWhere,
    },
    include: { document: { select: { id: true, title: true, documentType: true, platform: true, source: true, updatedAt: true } } },
    take: CANDIDATE_LIMIT,
    orderBy: { createdAt: "desc" },
  });

  const scored: RetrievedChunk[] = chunks.map((c) => {
    const sim = cosineSimilarity(queryEmbedding, c.embedding);
    const tier: RetrievedChunk["tier"] =
      c.document.source === "resolved-case" ? "resolved-case" : c.customerId ? "customer" : "organization";
    // Rerank: customer docs outrank org docs at equal similarity; resolved cases get a modest boost.
    const tierBoost = tier === "customer" ? 0.08 : tier === "resolved-case" ? 0.05 : 0;
    return {
      documentId: c.document.id,
      documentTitle: c.document.title,
      documentType: c.document.documentType,
      platform: c.document.platform,
      customerId: c.customerId,
      section: c.section,
      page: c.page,
      content: c.content,
      score: sim + tierBoost,
      tier,
    };
  });

  return scored
    .filter((c) => c.score >= MIN_SCORE) // don't return unrelated docs on weak keyword overlap
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
