import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, NotFoundError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { generatePostCallReview } from "@/lib/services/postcall";
import { postCallSchema } from "@/lib/schemas/recommendation";

export const POST = apiHandler(async (_req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireTenant("SPECIALIST");
  const content = await generatePostCallReview(ctx, params.id);
  return NextResponse.json({ content });
});

/** Saves user edits to the generated review. */
export const PATCH = apiHandler(async (req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireTenant("SPECIALIST");
  const content = postCallSchema.parse(await req.json());
  const review = await db.callReview.findFirst({ where: { callId: params.id, organizationId: ctx.organizationId } });
  if (!review) throw new NotFoundError("Generate the review first.");
  await db.callReview.update({ where: { id: review.id }, data: { content: content as object } });
  return NextResponse.json({ ok: true });
});
