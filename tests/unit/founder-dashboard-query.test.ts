import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  founderDirectoryHref,
  parseFounderDashboardQuery,
} from "../../lib/founder-dashboard-query";
import { cyprusCalendarMonthRangeUtc } from "../../lib/cyprus-calendar";

describe("parseFounderDashboardQuery", () => {
  it("defaults call-to-book range to 7 days", () => {
    const q = parseFounderDashboardQuery({});
    assert.equal(q.callToBookRange, "7d");
    assert.equal(q.outreachMonth, "current");
  });

  it("keeps call-to-book range in dashboard hrefs", () => {
    const q = parseFounderDashboardQuery({
      callToBookRange: "30d",
      visitsRange: "90d",
    });
    assert.equal(q.callToBookRange, "30d");
    assert.match(founderDirectoryHref(q), /callToBookRange=30d/);
    assert.match(founderDirectoryHref(q), /visitsRange=90d/);
    assert.match(founderDirectoryHref(q), /outreachMonth=current/);
  });

  it("keeps outreach month in dashboard hrefs", () => {
    const q = parseFounderDashboardQuery({ outreachMonth: "previous" });
    assert.equal(q.outreachMonth, "previous");
    assert.match(founderDirectoryHref(q), /outreachMonth=previous/);
  });
});

describe("cyprusCalendarMonthRangeUtc", () => {
  it("uses Cyprus calendar bounds for current and previous month", () => {
    const now = new Date("2026-08-21T08:00:00.000Z");
    const current = cyprusCalendarMonthRangeUtc(0, now);
    const previous = cyprusCalendarMonthRangeUtc(-1, now);
    assert.equal(current.label, "August 2026");
    assert.equal(previous.label, "July 2026");
    assert.equal(current.startIso, "2026-07-31T21:00:00.000Z");
    assert.equal(current.endIso, "2026-08-31T21:00:00.000Z");
    assert.equal(previous.startIso, "2026-06-30T21:00:00.000Z");
    assert.equal(previous.endIso, current.startIso);
  });
});
