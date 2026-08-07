import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiHandler, NotFoundError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { getStorage } from "@/lib/providers/storage";

export const DELETE = apiHandler(async (_req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireTenant("SPECIALIST");
  const doc = await db.document.findFirst({ where: { id: params.id, organizationId: ctx.organizationId, deletedAt: null } });
  if (!doc) throw new NotFoundError("Document not found.");
  await db.$transaction([
    db.documentChunk.deleteMany({ where: { documentId: doc.id } }),
    db.document.update({ where: { id: doc.id }, data: { deletedAt: new Date(), status: "PENDING" } }),
  ]);
  if (doc.storageKey) await getStorage().delete(doc.storageKey);
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "document.delete", resourceType: "document", resourceId: doc.id, metadata: { title: doc.title } });
  return NextResponse.json({ ok: true });
});
