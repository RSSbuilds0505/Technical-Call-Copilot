import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { retrieveContext } from "@/lib/services/retrieval";

const bodySchema = z.object({
  query: z.string().min(1).max(500),
  customerId: z.string().uuid().nullable().optional(),
});

/** Compact context search used by the right-hand panel; scoped to org + selected customer only. */
export const POST = apiHandler(async (req: Request) => {
  const ctx = await requireTenant();
  const body = bodySchema.parse(await req.json());
  const results = await retrieveContext({
    organizationId: ctx.organizationId,
    customerId: body.customerId ?? null,
    query: body.query,
    limit: 5,
  });
  return NextResponse.json({
    results: results.map((r) => ({ documentId: r.documentId, title: r.documentTitle, section: r.section, tier: r.tier, snippet: r.content.slice(0, 240), score: Number(r.score.toFixed(3)) })),
  });
});
