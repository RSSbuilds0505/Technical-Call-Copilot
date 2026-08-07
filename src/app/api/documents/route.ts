import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, AppError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { getStorage } from "@/lib/providers/storage";
import { enqueueIngestion } from "@/lib/services/ingestion";

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".csv"];
const MAX_SIZE = 15 * 1024 * 1024;

export const GET = apiHandler(async (req: Request) => {
  const ctx = await requireTenant();
  const url = new URL(req.url);
  const where: Record<string, unknown> = { organizationId: ctx.organizationId, deletedAt: null };
  const customerId = url.searchParams.get("customerId");
  const platform = url.searchParams.get("platform");
  const documentType = url.searchParams.get("documentType");
  const q = url.searchParams.get("q");
  if (customerId) where.customerId = customerId;
  if (platform) where.platform = platform;
  if (documentType) where.documentType = documentType;
  if (q) where.title = { contains: q, mode: "insensitive" };
  const documents = await db.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { id: true, name: true } }, _count: { select: { chunks: true } } },
    take: 200,
  });
  return NextResponse.json({ documents });
});

export const POST = apiHandler(async (req: Request) => {
  const ctx = await requireTenant("SPECIALIST");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("Attach a file to upload.", 422, "no_file");
  if (file.size > MAX_SIZE) throw new AppError("Files must be 15 MB or smaller.", 413, "too_large");
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new AppError(`Supported file types: ${ALLOWED_EXTENSIONS.join(", ")}.`, 415, "unsupported_type");
  }

  const meta = z.object({
    title: z.string().min(1).max(300).optional(),
    customerId: z.string().uuid().optional().nullable(),
    platform: z.string().max(80).optional().nullable(),
    documentType: z.string().max(80).optional().nullable(),
  }).parse({
    title: form.get("title") || undefined,
    customerId: form.get("customerId") || null,
    platform: form.get("platform") || null,
    documentType: form.get("documentType") || null,
  });

  if (meta.customerId) {
    const customer = await db.customer.findFirst({ where: { id: meta.customerId, organizationId: ctx.organizationId, deletedAt: null } });
    if (!customer) throw new AppError("That customer doesn't exist in your organization.", 404, "not_found");
  }

  const doc = await db.document.create({
    data: {
      organizationId: ctx.organizationId,
      customerId: meta.customerId ?? null,
      title: meta.title ?? file.name,
      documentType: meta.documentType,
      platform: meta.platform,
      fileName: file.name,
      mimeType: file.type || null,
      sizeBytes: file.size,
      accessLevel: meta.customerId ? "customer" : "organization",
      status: "PENDING",
    },
  });
  const storageKey = `${ctx.organizationId}/documents/${doc.id}${ext}`;
  await getStorage().put(storageKey, Buffer.from(await file.arrayBuffer()), file.type || undefined);
  await db.document.update({ where: { id: doc.id }, data: { storageKey } });
  await enqueueIngestion(doc.id);
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "document.upload", resourceType: "document", resourceId: doc.id, metadata: { title: doc.title } });
  return NextResponse.json({ document: doc }, { status: 201 });
});
