import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_TRIAL_MONTHS,
  MAX_TRIAL_MONTHS,
  addCyprusMonths,
  hasProAccess,
  parseTrialMonths,
  proAccessUntilForApproval,
} from "../../lib/pro-access";

/**
 * `professionals.pro_access_until` is the paid-tier entitlement (online bookings
 * today): access lasts while it is in the future. Approving a registration sets it to
 * the approval time plus the trial months, counted on the Cyprus calendar, so it ends
 * at the same local time of day whatever DST did in between. No trial (0 months)
 * means no access.
 */

describe("addCyprusMonths", () => {
  it("adds calendar months at the same Cyprus wall-clock time", () => {
    // 10:00 Cyprus in winter (UTC+2) is 08:00Z.
    assert.equal(
      addCyprusMonths(new Date("2026-01-15T08:00:00Z"), 6).toISOString(),
      "2026-07-15T07:00:00.000Z", // 10:00 Cyprus in summer (UTC+3)
    );
  });

  it("clamps to the end of a shorter month", () => {
    // 31 January 12:00 Cyprus + 1 month = 28 February 12:00 Cyprus.
    assert.equal(
      addCyprusMonths(new Date("2027-01-31T10:00:00Z"), 1).toISOString(),
      "2027-02-28T10:00:00.000Z",
    );
  });

  it("uses the Cyprus date near midnight, not the UTC one", () => {
    // 00:30 on 1 March Cyprus is still 28 February in UTC.
    assert.equal(
      addCyprusMonths(new Date("2027-02-28T22:30:00Z"), 1).toISOString(),
      "2027-03-31T21:30:00.000Z", // 00:30 on 1 April Cyprus (UTC+3)
    );
  });
});

describe("proAccessUntilForApproval", () => {
  it("is the approval time plus the trial months", () => {
    assert.equal(
      proAccessUntilForApproval(new Date("2026-10-01T09:00:00Z"), 6)?.toISOString(),
      "2027-04-01T09:00:00.000Z",
    );
  });

  it("gives no access without a trial", () => {
    assert.equal(proAccessUntilForApproval(new Date("2026-10-01T09:00:00Z"), 0), null);
  });
});

describe("hasProAccess", () => {
  const now = new Date("2026-10-01T12:00:00Z");

  it("is true while the date is in the future", () => {
    assert.equal(hasProAccess("2026-10-02T00:00:00Z", now), true);
  });

  // User, 2026-10-02: access lasts while now <= pro_access_until; it ends once we are past it.
  it("is still true at the exact moment, false once it has passed", () => {
    assert.equal(hasProAccess("2026-10-01T12:00:00Z", now), true);
    assert.equal(hasProAccess("2026-10-01T11:59:59.999Z", now), false);
    assert.equal(hasProAccess("2026-09-30T00:00:00Z", now), false);
  });

  it("is false with no date or an unreadable one", () => {
    assert.equal(hasProAccess(null, now), false);
    assert.equal(hasProAccess(undefined, now), false);
    assert.equal(hasProAccess("not a date", now), false);
  });
});

describe("parseTrialMonths", () => {
  it("accepts whole months from 0 up to the maximum", () => {
    assert.equal(parseTrialMonths(0), 0);
    assert.equal(parseTrialMonths(6), 6);
    assert.equal(parseTrialMonths("3"), 3);
    assert.equal(parseTrialMonths(MAX_TRIAL_MONTHS), MAX_TRIAL_MONTHS);
  });

  it("rejects anything else", () => {
    for (const bad of [-1, MAX_TRIAL_MONTHS + 1, 1.5, "six", "", null, undefined, NaN, {}]) {
      assert.equal(parseTrialMonths(bad), null, `accepted ${String(bad)}`);
    }
  });

  it("defaults to six months, the free trial the sign-up page promises", () => {
    assert.equal(DEFAULT_TRIAL_MONTHS, 6);
  });
});
