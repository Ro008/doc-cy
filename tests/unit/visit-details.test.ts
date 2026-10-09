import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { visitDetailsFromRow } from "../../lib/visit-details";

// 2026-09-25 is summer time in Cyprus (UTC+3): 06:50Z is 09:50 local.
const NOW = Date.parse("2026-09-25T06:50:00Z");

const base = {
  id: "v1",
  professional_id: "p1",
  patient_name: "Maria K.",
  patient_phone: "+35799123456",
  appointment_datetime: "2026-09-25T08:30:00Z",
  status: "CONFIRMED",
  duration_minutes: 45,
};

describe("visitDetailsFromRow", () => {
  it("labels the visit in Cyprus time and keeps the row", () => {
    const visit = visitDetailsFromRow(base, NOW);
    assert.equal(visit.dateLabel, "25/09/2026");
    assert.equal(visit.timeLabel, "11:30");
    assert.equal(visit.gridStartIso, base.appointment_datetime);
    assert.equal(visit.rowDurationMinutes, 45);
    assert.equal(visit.patient_name, "Maria K.");
    assert.equal(visit.isCounterOfferHold, false);
  });

  it("falls back to 30 minutes when the length is missing or invalid", () => {
    assert.equal(visitDetailsFromRow({ ...base, duration_minutes: null }, NOW).rowDurationMinutes, 30);
    assert.equal(visitDetailsFromRow({ ...base, duration_minutes: 0 }, NOW).rowDurationMinutes, 30);
  });

  it("offers the review link only for a request still open", () => {
    const open = visitDetailsFromRow({ ...base, status: "REQUESTED" }, NOW);
    assert.equal(open.showReviewLink, true);
    assert.equal(open.isExpired, false);

    const started = visitDetailsFromRow({ ...base, status: "REQUESTED", appointment_datetime: "2026-09-25T06:00:00Z" }, NOW);
    assert.equal(started.showReviewLink, false);
    assert.equal(started.isExpired, true);

    assert.equal(visitDetailsFromRow(base, NOW).showReviewLink, false);
  });
});
