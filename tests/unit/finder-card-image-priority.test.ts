import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FINDER_LCP_CARD_IMAGE_PRIORITY,
  finderCardImagePriority,
} from "@/lib/finder-card-image-priority";
import {
  FINDER_DEFAULT_AVATAR_FEMALE,
  FINDER_DEFAULT_AVATAR_MALE,
  rewriteLegacyFinderDefaultAvatarUrl,
} from "@/lib/finder-default-avatars";

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

describe("default finder avatars", () => {
  it("uses compressed WebP placeholders", () => {
    assert.equal(FINDER_DEFAULT_AVATAR_MALE, "/finder/avatars/default-male.webp");
    assert.equal(FINDER_DEFAULT_AVATAR_FEMALE, "/finder/avatars/default-female.webp");
  });

  it("rewrites legacy PNG placeholder URLs", () => {
    assert.equal(
      rewriteLegacyFinderDefaultAvatarUrl("/finder/avatars/default-female.png"),
      FINDER_DEFAULT_AVATAR_FEMALE,
    );
    assert.equal(
      rewriteLegacyFinderDefaultAvatarUrl("https://www.mydoccy.com/finder/avatars/default-male.png"),
      FINDER_DEFAULT_AVATAR_MALE,
    );
    assert.equal(rewriteLegacyFinderDefaultAvatarUrl("/finder/manual-photos/x.png"), "/finder/manual-photos/x.png");
    assert.equal(rewriteLegacyFinderDefaultAvatarUrl(null), null);
  });
});
