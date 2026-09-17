import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CALL_TO_BOOK_BUTTON_LABEL,
  aggregateCallToBookClicks,
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
  it("accepts finder and professional profile-page sources", () => {
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

describe("aggregateCallToBookClicks", () => {
  it("counts clicks per professional and splits finder vs professional profile page", () => {
    const stats = aggregateCallToBookClicks([
      {
        manualId: "m1",
        clinicId: "c1",
        source: "finder_card",
        createdAt: "2026-08-01T10:00:00.000Z",
      },
      {
        manualId: "m1",
        clinicId: "c2",
        source: "professional_profile_page",
        createdAt: "2026-08-02T10:00:00.000Z",
      },
      {
        manualId: "m2",
        clinicId: null,
        source: "finder_card",
        createdAt: "2026-08-03T10:00:00.000Z",
      },
    ]);
    assert.equal(stats.total, 3);
    assert.equal(stats.finderCount, 2);
    assert.equal(stats.professionalProfileCount, 1);
    assert.equal(stats.byProfessional[0]?.manualId, "m1");
    assert.equal(stats.byProfessional[0]?.count, 2);
    assert.equal(stats.byProfessional[0]?.finderCount, 1);
    assert.equal(stats.byProfessional[0]?.professionalProfileCount, 1);
    assert.equal(stats.byProfessional[0]?.lastAt, "2026-08-02T10:00:00.000Z");
    assert.equal(stats.byProfessional[1]?.manualId, "m2");
    assert.equal(stats.byProfessional[1]?.count, 1);
  });
});

describe("sumCallToBookStats", () => {
  it("sums pre-aggregated per-professional rows from the SQL RPC", () => {
    const totals = sumCallToBookStats([
      { professional_id: "m1", click_count: 5, finder_count: 3, profile_count: 2, last_at: null },
      { professional_id: "m2", click_count: "2", finder_count: "0", profile_count: "2", last_at: null },
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
          click_count: "4",
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
          click_count: 1,
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
