import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { finderAvailabilityRequestKey } from "@/lib/public/finder-availability-request-key";

describe("finder availability request key", () => {
  it("dedupes and sorts doctor ids so streamed cards share one batch", () => {
    assert.equal(finderAvailabilityRequestKey(["b", "a", "b"]), "a,b");
    assert.equal(finderAvailabilityRequestKey([]), "");
    assert.equal(finderAvailabilityRequestKey(["", "x"]), "x");
  });
});
