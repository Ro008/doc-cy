import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  consumePublicApiRateLimit,
  resetPublicApiRateLimitStoreForTests,
} from "@/lib/public-api-rate-limit";

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
