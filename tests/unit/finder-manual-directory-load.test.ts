import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extrasNotInPrimary,
  mustChunkExtraManualIds,
} from "@/lib/finder-manual-directory-load";
import { SUPABASE_IN_FILTER_CHUNK } from "@/lib/supabase-fetch-all";

/**
 * Regression: Limassol clinic-linked IDs (~2k) in one PostgREST
 * `.or(...,id.in.(uuid,...))` blew up the finder with an empty error.
 * Extras must be merged via chunked `id.in` (≤ SUPABASE_IN_FILTER_CHUNK).
 * See `.cursor/rules/supabase-row-cap-safety.mdc`.
 */
describe("finder manual directory load (clinic-district extras)", () => {
  it("drops extras already present in the primary district result", () => {
    assert.deepEqual(extrasNotInPrimary(["a", "b"], ["b", "c", "a", "d"]), ["c", "d"]);
    assert.deepEqual(extrasNotInPrimary([], ["x"]), ["x"]);
    assert.deepEqual(extrasNotInPrimary(["a"], []), []);
  });

  it("requires chunking when extras exceed the PostgREST-safe IN size", () => {
    assert.equal(mustChunkExtraManualIds(SUPABASE_IN_FILTER_CHUNK), false);
    assert.equal(mustChunkExtraManualIds(SUPABASE_IN_FILTER_CHUNK + 1), true);
    // Limassol-scale extras (incident 2026-08) must always chunk.
    assert.equal(mustChunkExtraManualIds(1900), true);
  });
});
