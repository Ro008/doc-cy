import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROFILE_HEADLINE_MAX_LENGTH,
  normalizeProfileHeadline,
  profileHeadlineError,
} from "../../lib/profile-headline";

describe("normalizeProfileHeadline", () => {
  it("trims and collapses whitespace and line breaks", () => {
    assert.equal(
      normalizeProfileHeadline("  Skin care   for the\nwhole family  "),
      "Skin care for the whole family",
    );
  });

  it("returns null when there is nothing to show", () => {
    for (const raw of [null, undefined, "", "   ", "\n\t", 42, {}]) {
      assert.equal(normalizeProfileHeadline(raw), null);
    }
  });

  it("never shows more than the limit, cutting at a word and adding an ellipsis", () => {
    assert.equal(PROFILE_HEADLINE_MAX_LENGTH, 90);
    const long = "word ".repeat(40);
    const shown = normalizeProfileHeadline(long);
    assert.ok(shown);
    assert.ok(shown.length <= PROFILE_HEADLINE_MAX_LENGTH);
    assert.ok(shown.endsWith("…"));
    assert.ok(!shown.includes("wor…"));
  });

  it("keeps a headline of exactly the limit untouched", () => {
    const exact = "a".repeat(PROFILE_HEADLINE_MAX_LENGTH);
    assert.equal(normalizeProfileHeadline(exact), exact);
  });
});

describe("profileHeadlineError", () => {
  it("accepts empty (the headline is optional) and anything up to the limit", () => {
    assert.equal(profileHeadlineError(""), null);
    assert.equal(profileHeadlineError("   "), null);
    assert.equal(profileHeadlineError("a".repeat(PROFILE_HEADLINE_MAX_LENGTH)), null);
  });

  it("flags text over the limit after normalising spaces", () => {
    assert.equal(profileHeadlineError("a".repeat(PROFILE_HEADLINE_MAX_LENGTH + 1)), "too_long");
    assert.equal(profileHeadlineError(`  ${"a".repeat(PROFILE_HEADLINE_MAX_LENGTH)}  `), null);
  });
});
