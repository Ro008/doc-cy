import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NOTHING_TO_PAY_TODAY, planSummary } from "../../lib/settings-plan";
import { SETTINGS_SECTIONS } from "../../lib/settings-sections";

/**
 * Plan & billing (user, 2026-10-01): the professional's own terms, read from
 * professionals.pro_access_until and subscription_tier. No payments exist yet, so the
 * tab says there is nothing to pay today and that subscribing opens here before the
 * free period ends; it never shows a payment form or a "coming soon" placeholder.
 */

const now = new Date("2026-10-01T09:00:00Z");

describe("planSummary", () => {
  it("counts down a Founding Member's free period to its end date", () => {
    const plan = planSummary({ proAccessUntil: "2027-03-15T10:00:00Z", isFounder: true, now });
    assert.equal(plan.tierLabel, "Founding Member");
    assert.equal(plan.state, "free");
    assert.equal(plan.endsOn, "15 March 2027");
    assert.equal(plan.daysLeft, 166);
    assert.equal(plan.priceAfter, "€19/month, locked for life");
  });

  it("uses the standard price for everyone else", () => {
    const plan = planSummary({ proAccessUntil: "2027-03-15T10:00:00Z", isFounder: false, now });
    assert.equal(plan.tierLabel, "Standard");
    assert.equal(plan.priceAfter, "€49/month");
  });

  it("warns in the last 30 days", () => {
    assert.equal(planSummary({ proAccessUntil: "2026-10-31T09:00:00Z", isFounder: true, now }).state, "ending_soon");
    assert.equal(planSummary({ proAccessUntil: "2026-11-01T09:00:00Z", isFounder: true, now }).state, "free");
  });

  it("says when the free period has ended", () => {
    const plan = planSummary({ proAccessUntil: "2026-09-20T09:00:00Z", isFounder: true, now });
    assert.equal(plan.state, "ended");
    assert.equal(plan.daysLeft, 0);
    assert.equal(plan.endsOn, "20 September 2026");
  });

  it("has no dates for a profile without online booking yet", () => {
    const plan = planSummary({ proAccessUntil: null, isFounder: false, now });
    assert.equal(plan.state, "none");
    assert.equal(plan.endsOn, null);
    assert.equal(plan.daysLeft, null);
  });

  it("dates the end on the Cyprus calendar", () => {
    // 23:30 UTC on 14 March is already 15 March in Cyprus.
    assert.equal(planSummary({ proAccessUntil: "2027-03-14T23:30:00Z", isFounder: true, now }).endsOn, "15 March 2027");
  });
});

describe("Plan & billing copy", () => {
  it("promises nothing that does not exist yet", () => {
    assert.match(NOTHING_TO_PAY_TODAY, /^Nothing to pay today\./);
    assert.doesNotMatch(NOTHING_TO_PAY_TODAY, /coming soon/i);
  });

  it("has its own section before Account", () => {
    const ids = SETTINGS_SECTIONS.map((s) => s.id);
    assert.equal(SETTINGS_SECTIONS.find((s) => s.id === "plan")?.label, "Plan & billing");
    assert.equal(ids.indexOf("plan"), ids.indexOf("account") - 1);
  });
});
