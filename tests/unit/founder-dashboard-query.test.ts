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
  parseDirectoryClicksCsvAction,
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
    });
    assert.equal(q.callToBookRange, "30d");
    assert.match(founderDirectoryHref(q), /callToBookRange=30d/);
    // These links live on the Statistics tab and must stay there.
    assert.match(founderDirectoryHref(q), /[?&]tab=statistics(&|$)/);
    assert.doesNotMatch(founderDirectoryHref(q), /visitsRange=/);
  });

  it("builds a CSV href from the selected table ranges", () => {
    const q = parseFounderDashboardQuery({
      callToBookRange: "30d",
      manualVotesRange: "7d",
    });
    assert.equal(
      founderDirectoryClicksCsvHref(q, "show_clinic_phone_number"),
      "/api/internal/directory-clicks.csv?action=show_clinic_phone_number&callToBookRange=30d",
    );
    assert.equal(
      founderDirectoryClicksCsvHref(q, "request_online_appointment"),
      "/api/internal/directory-clicks.csv?action=request_online_appointment&manualVotesRange=7d",
    );
  });
});

describe("parseDirectoryClicksCsvAction", () => {
  it("takes the two actions by their names, and the old phone name no more (step 2, 2026-10-15)", () => {
    assert.equal(parseDirectoryClicksCsvAction("show_clinic_phone_number"), "show_clinic_phone_number");
    assert.equal(parseDirectoryClicksCsvAction("request_online_appointment"), "request_online_appointment");
    assert.equal(parseDirectoryClicksCsvAction("show_phone_number"), null);
    assert.equal(parseDirectoryClicksCsvAction(null), null);
  });
});
