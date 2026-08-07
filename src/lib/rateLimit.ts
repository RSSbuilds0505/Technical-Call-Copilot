import { AppError } from "./errors";

/**
 * Fixed-window rate limiter held in process memory.
 *
 * Correct for the single-instance deployment this app targets. If the app is
 * ever scaled horizontally, this must move to Redis alongside the live bus,
 * because per-instance counters would let an attacker multiply their allowance
 * by the instance count.
 */

interface Window { count: number; resetAt: number }
const windows = new Map<string, Window>();
let lastSweep = Date.now();

/** Drop expired entries occasionally so the map cannot grow without bound. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, w] of windows) if (w.resetAt <= now) windows.delete(key);
}

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  sweep(now);
  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  existing.count += 1;
  if (existing.count > limit) {
    const seconds = Math.ceil((existing.resetAt - now) / 1000);
    throw new AppError(`Too many attempts. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`, 429, "rate_limited");
  }
}

/**
 * Best-effort client identifier. Behind Railway's proxy the real address is in
 * x-forwarded-for; the first entry is the client. Falls back to a shared bucket,
 * which is deliberately conservative: unknown clients share one allowance.
 */
export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}
