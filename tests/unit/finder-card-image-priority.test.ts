import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FINDER_LCP_CARD_IMAGE_PRIORITY,
  finderCardImagePriority,
} from "@/lib/finder-card-image-priority";

describe("finderCardImagePriority", () => {
  it("eager-loads the first viewport cards and prioritizes the first two", () => {
    assert.deepEqual(finderCardImagePriority(0), {
      loading: "eager",
      fetchPriority: "high",
    });
    assert.deepEqual(finderCardImagePriority(1), {
      loading: "eager",
      fetchPriority: "high",
    });
    assert.deepEqual(finderCardImagePriority(2), { loading: "eager" });
    assert.deepEqual(finderCardImagePriority(3), { loading: "eager" });
  });

  it("lazy-loads cards below the first viewport", () => {
    assert.deepEqual(finderCardImagePriority(4), { loading: "lazy" });
    assert.deepEqual(finderCardImagePriority(29), { loading: "lazy" });
  });

  it("marks a lone landing photo as LCP", () => {
    assert.equal(FINDER_LCP_CARD_IMAGE_PRIORITY.loading, "eager");
    assert.equal(FINDER_LCP_CARD_IMAGE_PRIORITY.fetchPriority, "high");
  });
});
