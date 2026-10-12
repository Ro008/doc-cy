import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PLAN_NOTE, PLAN_NOTE_ENDED, planSummary } from "../../lib/settings-plan";
import { SETTINGS_SECTIONS } from "../../lib/settings-sections";

/**
 * Plan & billing (user, 2026-10-01): the professional's own terms, read from
 * professionals.pro_access_until. No payments exist yet, so the tab says there is
 * nothing to pay today; it never shows a payment form or a "coming soon" placeholder.
 * User, 2026-10-12: no price and no tier until the subscription work (Stripe, the
 * Founders' Club); the countdown stays, and the tab says plainly that online booking
 * is paid after the free period, so nobody thinks it was free forever.
 */

const now = new Date("2026-10-01T09:00:00Z");

describe("planSummary", () => {
  it("counts down the free period to its end date", () => {
    const plan = planSummary({ proAccessUntil: "2027-03-15T10:00:00Z", now });
    assert.equal(plan.state, "free");
    assert.equal(plan.endsOn, "15 March 2027");
    assert.equal(plan.daysLeft, 166);
  });

  it("names no price and no tier", () => {
    const plan = planSummary({ proAccessUntil: "2027-03-15T10:00:00Z", now });
    assert.deepEqual(Object.keys(plan).sort(), ["daysLeft", "endsOn", "state"]);
  });

  it("warns in the last 30 days", () => {
    assert.equal(planSummary({ proAccessUntil: "2026-10-31T09:00:00Z", now }).state, "ending_soon");
    assert.equal(planSummary({ proAccessUntil: "2026-11-01T09:00:00Z", now }).state, "free");
  });

  it("says when the free period has ended", () => {
    const plan = planSummary({ proAccessUntil: "2026-09-20T09:00:00Z", now });
    assert.equal(plan.state, "ended");
    assert.equal(plan.daysLeft, 0);
    assert.equal(plan.endsOn, "20 September 2026");
  });

  it("has no dates for a profile without online booking yet", () => {
    const plan = planSummary({ proAccessUntil: null, now });
    assert.equal(plan.state, "none");
    assert.equal(plan.endsOn, null);
    assert.equal(plan.daysLeft, null);
  });

  it("dates the end on the Cyprus calendar", () => {
    // 23:30 UTC on 14 March is already 15 March in Cyprus.
    assert.equal(planSummary({ proAccessUntil: "2027-03-14T23:30:00Z", now }).endsOn, "15 March 2027");
  });
});

describe("Plan & billing copy", () => {
  it("promises nothing that does not exist yet: no price, no subscribe-here, no coming soon", () => {
    for (const note of [PLAN_NOTE, PLAN_NOTE_ENDED]) {
      assert.match(note, /^Nothing to pay today/);
      assert.doesNotMatch(note, /coming soon/i);
      assert.doesNotMatch(note, /€|\bsubscribe here\b/i);
      assert.match(note, /Your public profile stays free/);
    }
  });

  it("says online booking is paid after the free period, and that she is told well before", () => {
    assert.match(PLAN_NOTE, /After your free period, online booking continues with a paid subscription\./);
    assert.match(PLAN_NOTE, /Nothing changes without notice: we’ll contact you well before it ends/);
  });

  it("has its own section before Account", () => {
    const ids = SETTINGS_SECTIONS.map((s) => s.id);
    assert.equal(SETTINGS_SECTIONS.find((s) => s.id === "plan")?.label, "Plan & billing");
    assert.equal(ids.indexOf("plan"), ids.indexOf("account") - 1);
  });
});
