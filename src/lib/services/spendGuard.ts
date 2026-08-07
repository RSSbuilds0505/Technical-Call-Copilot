import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

/**
 * Per-organization daily AI spend ceiling.
 *
 * Without this, a retry loop or an unusually long call can run up provider cost
 * with no upper bound. The cap is enforced before each generation, using the
 * tokens already recorded today. It is intentionally conservative and cheap to
 * evaluate: one aggregate query per generation.
 *
 * Configure with AI_DAILY_TOKEN_CAP (total tokens per org per UTC day).
 * Set to 0 to disable, which is not recommended outside local development.
 */

const DEFAULT_CAP = 750_000;

export function dailyTokenCap(): number {
  const raw = process.env.AI_DAILY_TOKEN_CAP;
  if (raw === undefined) return DEFAULT_CAP;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_CAP;
}

function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export interface SpendStatus {
  used: number;
  cap: number;
  remaining: number;
  capped: boolean;
}

export async function getSpendStatus(organizationId: string): Promise<SpendStatus> {
  const cap = dailyTokenCap();
  if (cap === 0) return { used: 0, cap: 0, remaining: Number.POSITIVE_INFINITY, capped: false };

  const agg = await db.aIUsageRecord.aggregate({
    where: { organizationId, createdAt: { gte: startOfUtcDay() } },
    _sum: { inputTokens: true, outputTokens: true },
  });
  const used = (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0);
  return { used, cap, remaining: Math.max(0, cap - used), capped: used >= cap };
}

/**
 * Throws if the organization has exhausted its daily allowance. Called before
 * any provider request so a capped org fails fast and visibly rather than
 * silently accruing cost.
 */
export async function assertWithinSpendCap(organizationId: string): Promise<void> {
  const status = await getSpendStatus(organizationId);
  if (status.capped) {
    throw new AppError(
      `This organization has reached its daily AI usage limit (${status.cap.toLocaleString()} tokens). Guidance will resume tomorrow, or an administrator can raise the limit.`,
      429,
      "spend_cap_reached"
    );
  }
}
