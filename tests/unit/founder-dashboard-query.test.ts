import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  founderDirectoryClicksCsvHref,
  founderDirectoryHref,
  getCallToBookRangeLabel,
  getCallToBookWindowDays,
  getManualVotesRangeLabel,
  getManualVotesWindowDays,
  nextCallToBookSort,
  parseFounderDashboardQuery,
} from "../../lib/founder-dashboard-query";

describe("parseFounderDashboardQuery", () => {
  it("defaults call-to-book range to all time", () => {
    const q = parseFounderDashboardQuery({});
    assert.equal(q.callToBookRange, "all");
    assert.equal(getCallToBookWindowDays("all"), null);
    assert.equal(getCallToBookRangeLabel("all"), "All time");
  });

  it("defaults manual votes range to all time", () => {
    const q = parseFounderDashboardQuery({});
    assert.equal(q.manualVotesRange, "all");
    assert.equal(getManualVotesWindowDays("all"), null);
    assert.equal(getManualVotesRangeLabel("all"), "All time");
  });

  it("defaults call-to-book sort to clicks descending", () => {
    const q = parseFounderDashboardQuery({});
    assert.equal(q.callToBookCol, "clicks");
    assert.equal(q.callToBookDir, "desc");
  });

  it("keeps call-to-book sort in dashboard hrefs and toggles", () => {
    const q = parseFounderDashboardQuery({
      callToBookCol: "name",
      callToBookDir: "asc",
    });
    assert.match(founderDirectoryHref(q), /callToBookCol=name/);
    assert.match(founderDirectoryHref(q), /callToBookDir=asc/);
    assert.deepEqual(nextCallToBookSort(q, "name"), {
      callToBookCol: "name",
      callToBookDir: "desc",
    });
    assert.deepEqual(nextCallToBookSort(q, "clicks"), {
      callToBookCol: "clicks",
      callToBookDir: "desc",
    });
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
