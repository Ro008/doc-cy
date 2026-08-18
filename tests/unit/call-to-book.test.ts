import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateCallToBookClicks,
  parseCallToBookSource,
} from "../../lib/call-to-book";

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
