import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiHandler, NotFoundError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { enqueueIngestion } from "@/lib/services/ingestion";

export const POST = apiHandler(async (_req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireTenant("SPECIALIST");
  const doc = await db.document.findFirst({ where: { id: params.id, organizationId: ctx.organizationId, deletedAt: null } });
  if (!doc) throw new NotFoundError("Document not found.");
  await db.document.update({ where: { id: doc.id }, data: { status: "PENDING", errorMessage: null } });
  await enqueueIngestion(doc.id);
  return NextResponse.json({ ok: true });
});
