import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CALL_TO_BOOK_BUTTON_LABEL,
  buildCallToBookDashboardRows,
  parseCallToBookSource,
  sumCallToBookStats,
} from "../../lib/call-to-book";

describe("CALL_TO_BOOK_BUTTON_LABEL", () => {
  it("uses Show phone number for the public CTA", () => {
    assert.equal(CALL_TO_BOOK_BUTTON_LABEL, "Show phone number");
  });
});

describe("parseCallToBookSource", () => {
  it("accepts finder, professional profile-page and clinic-page sources", () => {
    assert.equal(parseCallToBookSource("clinic_page"), "clinic_page");
    assert.equal(parseCallToBookSource("finder_card"), "finder_card");
    assert.equal(parseCallToBookSource("professional_profile_page"), "professional_profile_page");
    assert.equal(parseCallToBookSource("profile_page"), "professional_profile_page");
    assert.equal(parseCallToBookSource("professional_landing"), "professional_profile_page");
  });

  it("rejects booking-modal and unknown sources so they are not logged", () => {
    assert.equal(parseCallToBookSource("booking_modal"), null);
    assert.equal(parseCallToBookSource("clinic_landing"), null);
    assert.equal(parseCallToBookSource(""), null);
  });
});

describe("the founders' counts", () => {
  it("come grouped from the database: no aggregation of raw clicks in the app", async () => {
    const mod = await import("../../lib/call-to-book");
    assert.equal("aggregateCallToBookClicks" in mod, false);
  });
});

describe("sumCallToBookStats", () => {
  it("sums pre-aggregated per-professional rows from the SQL RPC", () => {
    const totals = sumCallToBookStats([
      { professional_id: "m1", event_count: 5, visitor_count: 5, finder_count: 3, profile_count: 2, last_at: null },
      { professional_id: "m2", event_count: "2", visitor_count: "2", finder_count: "0", profile_count: "2", last_at: null },
    ]);
    assert.deepEqual(totals, { total: 7, finderCount: 3, professionalProfileCount: 4 });
  });

  it("returns zero totals for an empty result set", () => {
    assert.deepEqual(sumCallToBookStats([]), {
      total: 0,
      finderCount: 0,
      professionalProfileCount: 0,
    });
  });
});

describe("buildCallToBookDashboardRows", () => {
  it("fills in professional metadata and coerces numeric-string counts", () => {
    const rows = buildCallToBookDashboardRows(
      [
        {
          professional_id: "m1",
          event_count: "4",
          visitor_count: "4",
          finder_count: "3",
          profile_count: "1",
          last_at: "2026-08-02T10:00:00.000Z",
        },
      ],
      new Map([["m1", { name: "Vera Politou", district: "Paphos", specialty: "Dentist" }]]),
    );
    assert.deepEqual(rows, [
      {
        manualId: "m1",
        name: "Vera Politou",
        district: "Paphos",
        specialty: "Dentist",
        count: 4,
        finderCount: 3,
        professionalProfileCount: 1,
        lastAt: "2026-08-02T10:00:00.000Z",
      },
    ]);
  });

  it("falls back to a truncated id when the professional has no name on file", () => {
    const rows = buildCallToBookDashboardRows(
      [
        {
          professional_id: "0123456789abcdef",
          event_count: 1,
          visitor_count: 1,
          finder_count: 1,
          profile_count: 0,
          last_at: null,
        },
      ],
      new Map(),
    );
    assert.equal(rows[0]?.name, "01234567");
    assert.equal(rows[0]?.lastAt, "");
  });
});
