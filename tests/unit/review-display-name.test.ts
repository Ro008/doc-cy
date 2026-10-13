import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { reviewDisplayName } from "../../lib/review-display-name";

/**
 * Public reviews show first name + last initial ("Maria K."), never the full name:
 * on a health platform the full name would reveal who sees which professional
 * (user, 2026-10-04).
 */
describe("reviewDisplayName", () => {
  it("shows the first name and the initial of the last name", () => {
    assert.equal(reviewDisplayName("Maria Kyriakou"), "Maria K.");
  });

  it("uses the last word for the initial when there are middle names", () => {
    assert.equal(reviewDisplayName("Anna Maria Georgiou"), "Anna G.");
  });

  it("trims and collapses spaces", () => {
    assert.equal(reviewDisplayName("  maria   kyriakou  "), "Maria K.");
  });

  it("shows just the first name when there is only one", () => {
    assert.equal(reviewDisplayName("Maria"), "Maria");
  });

  it("handles Greek names", () => {
    assert.equal(reviewDisplayName("Μαρία Κυριάκου"), "Μαρία Κ.");
  });

  it("falls back for an empty name", () => {
    assert.equal(reviewDisplayName("   "), "A patient");
    assert.equal(reviewDisplayName(null), "A patient");
  });
});
