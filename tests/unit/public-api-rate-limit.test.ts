import assert from "node:assert/strict";
import { describe, it, beforeEach, after } from "node:test";
import {
  consumePublicApiRateLimit,
  enforcePublicApiRateLimit,
  isFinderBrowseAllowed,
  PUBLIC_API_RATE_LIMITS,
  resetPublicApiRateLimitStoreForTests,
} from "@/lib/public-api-rate-limit";
import { getClientIp } from "@/lib/vote-fingerprint";

/** Minimal `.get(name)` stand-in for a Server Component's `headers()` result. */
function fakeHeaders(values: Record<string, string | undefined>): Pick<Headers, "get"> {
  return {
    get: (name: string) => values[name.toLowerCase()] ?? null,
  };
}

function requestFromIp(ip: string): Request {
  return new Request("https://example.com/api/internal/auth", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

describe("consumePublicApiRateLimit", () => {
  beforeEach(() => {
    resetPublicApiRateLimitStoreForTests();
  });

  it("allows up to the limit within a window", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) {
      const result = consumePublicApiRateLimit({
        bucket: "test",
        key: "1.2.3.4",
        limit: 3,
        windowMs: 60_000,
        now,
      });
      assert.equal(result.ok, true);
    }

    const blocked = consumePublicApiRateLimit({
      bucket: "test",
      key: "1.2.3.4",
      limit: 3,
      windowMs: 60_000,
      now,
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.retryAfterSec, 60);
    }
  });

  it("isolates keys and buckets", () => {
    const now = 2_000_000;
    assert.equal(
      consumePublicApiRateLimit({
        bucket: "a",
        key: "ip-a",
        limit: 1,
        windowMs: 60_000,
        now,
      }).ok,
      true,
    );
    assert.equal(
      consumePublicApiRateLimit({
        bucket: "a",
        key: "ip-b",
        limit: 1,
        windowMs: 60_000,
        now,
      }).ok,
      true,
    );
    assert.equal(
      consumePublicApiRateLimit({
        bucket: "b",
        key: "ip-a",
        limit: 1,
        windowMs: 60_000,
        now,
      }).ok,
      true,
    );
    assert.equal(
      consumePublicApiRateLimit({
        bucket: "a",
        key: "ip-a",
        limit: 1,
        windowMs: 60_000,
        now,
      }).ok,
      false,
    );
  });

  it("resets after the window elapses", () => {
    const windowMs = 10_000;
    const t0 = 3_000_000;
    assert.equal(
      consumePublicApiRateLimit({
        bucket: "reset",
        key: "ip",
        limit: 1,
        windowMs,
        now: t0,
      }).ok,
      true,
    );
    assert.equal(
      consumePublicApiRateLimit({
        bucket: "reset",
        key: "ip",
        limit: 1,
        windowMs,
        now: t0 + 1,
      }).ok,
      false,
    );
    assert.equal(
      consumePublicApiRateLimit({
        bucket: "reset",
        key: "ip",
        limit: 1,
        windowMs,
        now: t0 + windowMs,
      }).ok,
      true,
    );
  });
});

describe("enforcePublicApiRateLimit(doctorInvitation)", () => {
  beforeEach(() => {
    resetPublicApiRateLimitStoreForTests();
  });

  it("allows the limit, then throttles the next attempt with a 429 + Retry-After", () => {
    const limit = PUBLIC_API_RATE_LIMITS.doctorInvitation.limit;
    const req = requestFromIp("192.0.2.50");
    for (let i = 0; i < limit; i += 1) {
      const result = enforcePublicApiRateLimit(req, "doctorInvitation");
      assert.equal(result, null, `attempt ${i + 1} should not be throttled`);
    }

    const throttled = enforcePublicApiRateLimit(req, "doctorInvitation");
    assert.notEqual(throttled, null);
    assert.equal(throttled?.status, 429);
    assert.ok(throttled?.headers.get("Retry-After"));
  });

  it("tracks each IP independently, so one guesser can't exhaust another visitor's budget", () => {
    const limit = PUBLIC_API_RATE_LIMITS.doctorInvitation.limit;
    const attacker = requestFromIp("192.0.2.60");
    const visitor = requestFromIp("192.0.2.61");
    for (let i = 0; i < limit; i += 1) {
      assert.equal(enforcePublicApiRateLimit(attacker, "doctorInvitation"), null);
    }
    assert.notEqual(enforcePublicApiRateLimit(attacker, "doctorInvitation"), null);
    // Another visitor on a different IP still has a full budget.
    assert.equal(enforcePublicApiRateLimit(visitor, "doctorInvitation"), null);
  });
});

describe("getClientIp", () => {
  it("reads the first hop off x-forwarded-for from any .get(name) header source", () => {
    // Works from a real Request...
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" },
    });
    assert.equal(getClientIp(req.headers), "9.9.9.9");

    // ...and from a plain object shaped like Next's headers() result, which
    // is what Server Components (the finder/clinics pages) actually have.
    assert.equal(
      getClientIp(fakeHeaders({ "x-forwarded-for": "8.8.8.8" })),
      "8.8.8.8",
    );
  });

  it("falls back to x-real-ip, then empty string", () => {
    assert.equal(getClientIp(fakeHeaders({ "x-real-ip": "1.1.1.1" })), "1.1.1.1");
    assert.equal(getClientIp(fakeHeaders({})), "");
  });
});

describe("isFinderBrowseAllowed", () => {
  const originalEnv = process.env.DOC_CY_PUBLIC_API_RATE_LIMIT;

  beforeEach(() => {
    resetPublicApiRateLimitStoreForTests();
    delete process.env.DOC_CY_PUBLIC_API_RATE_LIMIT;
  });

  it("allows finderBrowse.limit searches per IP, then blocks the next one", () => {
    const limit = PUBLIC_API_RATE_LIMITS.finderBrowse.limit;
    const h = fakeHeaders({ "x-forwarded-for": "203.0.113.5" });
    for (let i = 0; i < limit; i += 1) {
      assert.equal(isFinderBrowseAllowed(h), true, `request ${i + 1} should be allowed`);
    }
    assert.equal(isFinderBrowseAllowed(h), false);
  });

  it("tracks each IP independently", () => {
    const limit = PUBLIC_API_RATE_LIMITS.finderBrowse.limit;
    const a = fakeHeaders({ "x-forwarded-for": "203.0.113.10" });
    const b = fakeHeaders({ "x-forwarded-for": "203.0.113.11" });
    for (let i = 0; i < limit; i += 1) {
      assert.equal(isFinderBrowseAllowed(a), true);
    }
    assert.equal(isFinderBrowseAllowed(a), false);
    // A different visitor still has their own full budget.
    assert.equal(isFinderBrowseAllowed(b), true);
  });

  it("fails open when no IP can be determined (local dev, missing headers)", () => {
    assert.equal(isFinderBrowseAllowed(fakeHeaders({})), true);
  });

  it("fails open when DOC_CY_PUBLIC_API_RATE_LIMIT=off, even past the limit", () => {
    process.env.DOC_CY_PUBLIC_API_RATE_LIMIT = "off";
    const limit = PUBLIC_API_RATE_LIMITS.finderBrowse.limit;
    const h = fakeHeaders({ "x-forwarded-for": "203.0.113.20" });
    for (let i = 0; i < limit + 5; i += 1) {
      assert.equal(isFinderBrowseAllowed(h), true);
    }
  });

  after(() => {
    if (originalEnv === undefined) delete process.env.DOC_CY_PUBLIC_API_RATE_LIMIT;
    else process.env.DOC_CY_PUBLIC_API_RATE_LIMIT = originalEnv;
  });
});
