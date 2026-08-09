import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/vote-fingerprint";

export type PublicApiRateLimitBucket =
  | "manualBookingRequest"
  | "doctorInvitation"
  | "appointments"
  | "trafficLog"
  | "contactReveal";

type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

/** High enough for normal humans + light CI; low enough to blunt write spam. */
export const PUBLIC_API_RATE_LIMITS: Record<PublicApiRateLimitBucket, RateLimitConfig> = {
  manualBookingRequest: { limit: 10, windowMs: 60 * 60 * 1000 },
  doctorInvitation: { limit: 5, windowMs: 60 * 60 * 1000 },
  appointments: { limit: 20, windowMs: 60 * 60 * 1000 },
  trafficLog: { limit: 60, windowMs: 60 * 1000 },
  /** Phone reveal clicks — blunt bulk extraction of directory phones. */
  contactReveal: { limit: 40, windowMs: 60 * 60 * 1000 },
};

type BucketState = {
  count: number;
  resetAt: number;
};

const store = new Map<string, BucketState>();
let consumeCount = 0;

function storeKey(bucket: string, key: string): string {
  return `${bucket}:${key}`;
}

function pruneExpired(now: number): void {
  store.forEach((state, k) => {
    if (state.resetAt <= now) store.delete(k);
  });
}

export type ConsumeRateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; remaining: 0; resetAt: number; retryAfterSec: number };

/**
 * Fixed-window counter (in-memory per process).
 * On multi-instance hosts each instance has its own window — still stops burst spam.
 */
export function consumePublicApiRateLimit(input: {
  bucket: string;
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): ConsumeRateLimitResult {
  const now = input.now ?? Date.now();
  consumeCount += 1;
  if (consumeCount % 64 === 0) pruneExpired(now);

  const id = storeKey(input.bucket, input.key);
  let state = store.get(id);
  if (!state || state.resetAt <= now) {
    state = { count: 0, resetAt: now + input.windowMs };
    store.set(id, state);
  }

  if (state.count >= input.limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: state.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((state.resetAt - now) / 1000)),
    };
  }

  state.count += 1;
  return {
    ok: true,
    remaining: Math.max(0, input.limit - state.count),
    resetAt: state.resetAt,
  };
}

export function isPublicApiRateLimitDisabled(): boolean {
  const raw = (process.env.DOC_CY_PUBLIC_API_RATE_LIMIT ?? "").trim().toLowerCase();
  return raw === "0" || raw === "off" || raw === "false";
}

/**
 * Returns a 429 response when limited; otherwise null (caller proceeds).
 * Fail-open when client IP is missing (local/dev) so Playwright is not blocked.
 */
export function enforcePublicApiRateLimit(
  req: Request,
  bucket: PublicApiRateLimitBucket,
  options?: {
    body?: Record<string, unknown>;
  },
): NextResponse | null {
  if (isPublicApiRateLimitDisabled()) return null;

  const ip = getClientIp(req);
  if (!ip) return null;

  const cfg = PUBLIC_API_RATE_LIMITS[bucket];
  const result = consumePublicApiRateLimit({
    bucket,
    key: ip,
    limit: cfg.limit,
    windowMs: cfg.windowMs,
  });

  if (result.ok) return null;

  // Narrowed: result is the { ok: false } variant — cast for TS targets that don't narrow discriminated unions
  const limited = result as Extract<ConsumeRateLimitResult, { ok: false }>;
  console.warn(
    `[DocCy][rate-limit] bucket=${bucket} ip=${ip.slice(0, 48)} retryAfterSec=${limited.retryAfterSec}`,
  );

  const body =
    options?.body ??
    ({
      ok: false,
      reason: "rate_limited",
    } as Record<string, unknown>);

  return NextResponse.json(body, {
    status: 429,
    headers: {
      "Retry-After": String(limited.retryAfterSec),
    },
  });
}

/** Test-only: clear in-memory counters. */
export function resetPublicApiRateLimitStoreForTests(): void {
  store.clear();
  consumeCount = 0;
}
