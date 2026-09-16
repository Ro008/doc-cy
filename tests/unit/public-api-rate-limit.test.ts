import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  consumePublicApiRateLimit,
  enforcePublicApiRateLimit,
  PUBLIC_API_RATE_LIMITS,
  resetPublicApiRateLimitStoreForTests,
} from "@/lib/public-api-rate-limit";

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

describe("enforcePublicApiRateLimit(internalAuthLogin)", () => {
  beforeEach(() => {
    resetPublicApiRateLimitStoreForTests();
  });

  it("allows the first 3 attempts, then throttles the 4th with a 429 + Retry-After", () => {
    const limit = PUBLIC_API_RATE_LIMITS.internalAuthLogin.limit;
    const req = requestFromIp("192.0.2.50");
    for (let i = 0; i < limit; i += 1) {
      const result = enforcePublicApiRateLimit(req, "internalAuthLogin");
      assert.equal(result, null, `attempt ${i + 1} should not be throttled`);
    }

    const throttled = enforcePublicApiRateLimit(req, "internalAuthLogin");
    assert.notEqual(throttled, null);
    assert.equal(throttled?.status, 429);
    assert.ok(throttled?.headers.get("Retry-After"));
  });

  it("tracks each IP independently, so one guesser can't exhaust another visitor's budget", () => {
    const limit = PUBLIC_API_RATE_LIMITS.internalAuthLogin.limit;
    const attacker = requestFromIp("192.0.2.60");
    const founder = requestFromIp("192.0.2.61");
    for (let i = 0; i < limit; i += 1) {
      assert.equal(enforcePublicApiRateLimit(attacker, "internalAuthLogin"), null);
    }
    assert.notEqual(enforcePublicApiRateLimit(attacker, "internalAuthLogin"), null);
    // Founder's own attempt from a different IP still has a full budget.
    assert.equal(enforcePublicApiRateLimit(founder, "internalAuthLogin"), null);
  });
});
