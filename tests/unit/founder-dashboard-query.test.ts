import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  founderDirectoryHref,
  parseFounderDashboardQuery,
} from "../../lib/founder-dashboard-query";

describe("parseFounderDashboardQuery", () => {
  it("defaults call-to-book range to 7 days", () => {
    const q = parseFounderDashboardQuery({});
    assert.equal(q.callToBookRange, "7d");
  });

  it("keeps call-to-book range in dashboard hrefs", () => {
    const q = parseFounderDashboardQuery({
      callToBookRange: "30d",
      visitsRange: "90d",
    });
    assert.equal(q.callToBookRange, "30d");
    assert.match(founderDirectoryHref(q), /callToBookRange=30d/);
    assert.match(founderDirectoryHref(q), /visitsRange=90d/);
  });
});
