import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness and readiness probe for the platform health check.
 * Verifies the process is up and the database is reachable, and reports which
 * providers are active so a misconfigured deploy is visible without logging in.
 */
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "connected",
      latencyMs: Date.now() - started,
      providers: {
        ai: process.env.AI_PROVIDER ?? "mock",
        embeddings: process.env.EMBEDDING_PROVIDER ?? "local",
        transcription: process.env.TRANSCRIPTION_PROVIDER ?? "simulated",
        storage: process.env.STORAGE_DRIVER ?? "local",
      },
    });
  } catch {
    return NextResponse.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
