import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  founderDirectoryClicksCsvHref,
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

  it("builds a CSV href from the selected table ranges", () => {
    const q = parseFounderDashboardQuery({
      callToBookRange: "30d",
      manualVotesRange: "7d",
    });
    assert.equal(
      founderDirectoryClicksCsvHref(q, "show_phone_number"),
      "/api/internal/directory-clicks.csv?action=show_phone_number&callToBookRange=30d",
    );
    assert.equal(
      founderDirectoryClicksCsvHref(q, "request_online_appointment"),
      "/api/internal/directory-clicks.csv?action=request_online_appointment&manualVotesRange=7d",
    );
  });
});
