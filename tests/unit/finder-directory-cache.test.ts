import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FINDER_DIRECTORY_REVALIDATE_SECONDS,
  directoryIdSetCacheKey,
} from "@/lib/finder-directory-cache-key";

describe("finder directory cache helpers", () => {
  it("keeps a short shared TTL for listings", () => {
    assert.equal(FINDER_DIRECTORY_REVALIDATE_SECONDS, 45);
  });

  it("builds a stable compact key for id sets", () => {
    assert.equal(directoryIdSetCacheKey(["b", "a", "b"]), directoryIdSetCacheKey(["a", "b"]));
    assert.notEqual(directoryIdSetCacheKey(["a"]), directoryIdSetCacheKey(["c"]));
    assert.equal(directoryIdSetCacheKey([]), "0:0");
  });
});
