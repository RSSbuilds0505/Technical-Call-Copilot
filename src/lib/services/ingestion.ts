import { db } from "@/lib/db";
import { getQueue } from "@/lib/providers/queue";
import { getStorage } from "@/lib/providers/storage";
import { getEmbeddingProvider } from "@/lib/providers/embeddings";

export const INGEST_JOB = "document.ingest";

interface IngestPayload { documentId: string }

/** Splits extracted text into overlapping chunks aligned to paragraph boundaries. */
export function chunkText(text: string, maxChars = 1400, overlap = 200): { content: string; section: string | null }[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!cleaned) return [];
  const paragraphs = cleaned.split(/\n\n+/);
  const chunks: { content: string; section: string | null }[] = [];
  let current = "";
  let currentSection: string | null = null;

  const flush = () => {
    if (current.trim().length > 0) chunks.push({ content: current.trim(), section: currentSection });
    current = current.slice(Math.max(0, current.length - overlap));
  };

  for (const para of paragraphs) {
    // Treat markdown headings / short ALL-CAPS lines as section markers.
    const headingMatch = para.match(/^#{1,6}\s+(.{2,80})$/m) || (para.length < 80 && /^[A-Z0-9][A-Z0-9 \-:]{4,}$/.test(para.trim()) ? [para, para.trim()] : null);
    if (headingMatch) currentSection = headingMatch[1].trim();
    if (current.length + para.length + 2 > maxChars) flush();
    current += (current ? "\n\n" : "") + para;
    while (current.length > maxChars * 1.5) {
      const head = current.slice(0, maxChars);
      chunks.push({ content: head.trim(), section: currentSection });
      current = current.slice(maxChars - overlap);
    }
  }
  if (current.trim()) chunks.push({ content: current.trim(), section: currentSection });
  return chunks.filter((c) => c.content.length > 20);
}

async function extractText(buffer: Buffer, mimeType: string | null, fileName: string | null): Promise<string> {
  const name = (fileName ?? "").toLowerCase();
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
    // pdf-parse's index module runs debug code on import; load the lib entry directly.
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as (b: Buffer) => Promise<{ text: string }>;
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }
  if (name.endsWith(".docx") || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  // TXT, Markdown, CSV: treat as UTF-8 text. CSV rows become line-based chunks.
  return buffer.toString("utf8");
}

export function registerIngestionWorker(): void {
  const queue = getQueue();
  queue.register<IngestPayload>(INGEST_JOB, async ({ documentId }) => {
    const doc = await db.document.findUnique({ where: { id: documentId } });
    if (!doc || doc.deletedAt) return;
    try {
      await db.document.update({ where: { id: doc.id }, data: { status: "PROCESSING", errorMessage: null } });

      let text: string;
      if (doc.storageKey) {
        const buffer = await getStorage().get(doc.storageKey);
        text = await extractText(buffer, doc.mimeType, doc.fileName);
      } else {
        throw new Error("Document has no stored file to process.");
      }

      const chunks = chunkText(text);
      if (chunks.length === 0) throw new Error("No readable text was extracted from this file.");

      const embedder = getEmbeddingProvider();
      const embeddings = await embedder.embed(chunks.map((c) => c.content));

      await db.$transaction([
        db.documentChunk.deleteMany({ where: { documentId: doc.id } }),
        db.documentChunk.createMany({
          data: chunks.map((c, i) => ({
            documentId: doc.id,
            organizationId: doc.organizationId,
            customerId: doc.customerId,
            chunkIndex: i,
            content: c.content,
            section: c.section,
            tokenCount: Math.ceil(c.content.length / 4),
            embedding: embeddings[i],
          })),
        }),
        db.document.update({ where: { id: doc.id }, data: { status: "READY" } }),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Processing failed.";
      await db.document.update({ where: { id: doc.id }, data: { status: "FAILED", errorMessage: message } });
      throw err;
    }
  });
}

export async function enqueueIngestion(documentId: string): Promise<void> {
  registerIngestionWorker();
  await getQueue().enqueue<IngestPayload>(INGEST_JOB, { documentId });
}

/** Creates a READY text document directly (used for resolved-case knowledge and manual notes). */
export async function ingestInlineText(params: {
  organizationId: string;
  customerId?: string | null;
  title: string;
  content: string;
  documentType: string;
  platform?: string | null;
  source?: string;
}): Promise<string> {
  const chunks = chunkText(params.content);
  const embedder = getEmbeddingProvider();
  const embeddings = chunks.length > 0 ? await embedder.embed(chunks.map((c) => c.content)) : [];
  const doc = await db.document.create({
    data: {
      organizationId: params.organizationId,
      customerId: params.customerId ?? null,
      title: params.title,
      documentType: params.documentType,
      platform: params.platform ?? null,
      source: params.source ?? "manual",
      status: chunks.length > 0 ? "READY" : "FAILED",
      errorMessage: chunks.length > 0 ? null : "No readable text.",
      accessLevel: params.customerId ? "customer" : "organization",
      chunks: {
        create: chunks.map((c, i) => ({
          organizationId: params.organizationId,
          customerId: params.customerId ?? null,
          chunkIndex: i,
          content: c.content,
          section: c.section,
          tokenCount: Math.ceil(c.content.length / 4),
          embedding: embeddings[i],
        })),
      },
    },
  });
  return doc.id;
}
