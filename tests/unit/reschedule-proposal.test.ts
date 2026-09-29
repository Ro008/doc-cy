import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RESCHEDULE_REASON_MAX,
  RESCHEDULE_REASON_MIN,
  rescheduleDeadlineIso,
  rescheduleReasonState,
  sentSlotsDifferFromPreview,
} from "../../lib/reschedule-proposal";
import { computeProposalExpiresAt } from "../../lib/proposal-expires-at";

describe("rescheduleReasonState", () => {
  it("uses the same limits as the propose-reschedule API", () => {
    assert.equal(RESCHEDULE_REASON_MIN, 10);
    assert.equal(RESCHEDULE_REASON_MAX, 4000);
  });

  it("counts trimmed characters and flags a reason that is too short", () => {
    assert.deepEqual(rescheduleReasonState("  short  "), {
      length: 5,
      tooShort: true,
      tooLong: false,
      remaining: 3995,
    });
  });

  it("accepts a reason inside the limits", () => {
    const state = rescheduleReasonState("I have to be at the hospital that morning.");
    assert.equal(state.tooShort, false);
    assert.equal(state.tooLong, false);
  });

  it("flags a reason over the maximum", () => {
    const state = rescheduleReasonState("x".repeat(4001));
    assert.equal(state.tooLong, true);
    assert.equal(state.remaining, -1);
  });
});

describe("sentSlotsDifferFromPreview", () => {
  const a = "2026-10-01T07:00:00.000Z";
  const b = "2026-10-01T07:30:00.000Z";
  const c = "2026-10-01T08:00:00.000Z";

  it("is false when the server sent the previewed times", () => {
    assert.equal(sentSlotsDifferFromPreview([a, b, c], [a, b, c]), false);
  });

  it("ignores order and sub-minute differences in the ISO strings", () => {
    assert.equal(
      sentSlotsDifferFromPreview([a, b, c], [c, "2026-10-01T07:00:20.000Z", b]),
      false,
    );
  });

  it("is true when any sent time was not in the preview", () => {
    assert.equal(sentSlotsDifferFromPreview([a, b, c], [a, b, "2026-10-01T09:00:00.000Z"]), true);
  });

  it("is true when the counts differ", () => {
    assert.equal(sentSlotsDifferFromPreview([a, b, c], [a, b]), true);
  });

  it("is false when there was no preview to compare against", () => {
    assert.equal(sentSlotsDifferFromPreview(null, [a, b, c]), false);
  });
});

describe("rescheduleDeadlineIso", () => {
  it("matches the deadline the server will store for the earliest slot", () => {
    const now = new Date("2026-09-29T06:00:00.000Z");
    const slots = ["2026-10-02T07:00:00.000Z", "2026-10-01T07:00:00.000Z"];
    assert.equal(
      rescheduleDeadlineIso(now, slots),
      computeProposalExpiresAt(now, "2026-10-01T07:00:00.000Z").toISOString(),
    );
  });

  it("is null without slots", () => {
    assert.equal(rescheduleDeadlineIso(new Date(), []), null);
  });
});
