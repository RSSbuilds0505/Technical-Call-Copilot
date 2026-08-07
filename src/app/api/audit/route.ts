import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiHandler } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";

export const GET = apiHandler(async (req: Request) => {
  const ctx = await requireTenant("MANAGER");
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const logs = await db.auditLog.findMany({
    where: { organizationId: ctx.organizationId, ...(action ? { action } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ logs });
});
