import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FINDER_DIRECTORY_REVALIDATE_SECONDS,
  directoryIdSetCacheKey,
} from "@/lib/finder-directory-cache-key";
import { shouldBypassFinderDirectoryCache } from "@/lib/finder-directory-cache";

describe("finder directory cache helpers", () => {
  it("keeps a short shared TTL for listings", () => {
    assert.equal(FINDER_DIRECTORY_REVALIDATE_SECONDS, 45);
  });

  it("builds a stable compact key for id sets", () => {
    assert.equal(directoryIdSetCacheKey(["b", "a", "b"]), directoryIdSetCacheKey(["a", "b"]));
    assert.notEqual(directoryIdSetCacheKey(["a"]), directoryIdSetCacheKey(["c"]));
    assert.equal(directoryIdSetCacheKey([]), "0:0");
  });

  it("bypasses listing cache when integration test profiles are included", () => {
    const previous = process.env.NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES;
    try {
      process.env.NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES = "1";
      assert.equal(shouldBypassFinderDirectoryCache(), true);
      delete process.env.NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES;
      assert.equal(shouldBypassFinderDirectoryCache(), false);
    } finally {
      if (previous === undefined) {
        delete process.env.NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES;
      } else {
        process.env.NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES = previous;
      }
    }
  });
});
