import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseFinderLoadMoreSnapshot,
  serializeFinderLoadMoreSnapshot,
} from "../../lib/finder-load-more-scroll";

describe("finder load-more scroll snapshot", () => {
  it("round-trips a valid snapshot", () => {
    const snapshot = { scrollY: 1400, documentHeight: 4200 };
    assert.deepEqual(
      parseFinderLoadMoreSnapshot(serializeFinderLoadMoreSnapshot(snapshot)),
      snapshot,
    );
  });

  it("rejects missing or invalid payloads", () => {
    assert.equal(parseFinderLoadMoreSnapshot(null), null);
    assert.equal(parseFinderLoadMoreSnapshot(""), null);
    assert.equal(parseFinderLoadMoreSnapshot("not-json"), null);
    assert.equal(parseFinderLoadMoreSnapshot(JSON.stringify({ scrollY: -1, documentHeight: 10 })), null);
    assert.equal(parseFinderLoadMoreSnapshot(JSON.stringify({ scrollY: 10, documentHeight: 0 })), null);
  });
});
