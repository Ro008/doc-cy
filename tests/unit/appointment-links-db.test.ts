import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appointmentLinkState, patientCancelDeadlineLabel } from "../../lib/appointment-links-db";

/** Patient links (proposal / cancel / review): single use, expiring, revocable. */
describe("appointmentLinkState", () => {
  const now = new Date("2026-10-05T10:00:00Z");

  it("is usable while unused and unexpired", () => {
    assert.equal(appointmentLinkState({ expires_at: "2026-10-06T00:00:00Z", used_at: null }, now), "usable");
  });

  it("is used once used (or revoked)", () => {
    assert.equal(
      appointmentLinkState({ expires_at: "2026-10-06T00:00:00Z", used_at: "2026-10-05T09:00:00Z" }, now),
      "used",
    );
  });

  it("is expired from its expiry on", () => {
    assert.equal(appointmentLinkState({ expires_at: "2026-10-05T10:00:00Z", used_at: null }, now), "expired");
  });

  it("is invalid with no link", () => {
    assert.equal(appointmentLinkState(null, now), "invalid");
  });
});

describe("patientCancelDeadlineLabel", () => {
  it("is the visit time minus the notice, in Cyprus time", () => {
    // Visit Sat 10 Oct 10:00 Cyprus (07:00Z); 24 h before = Fri 9 Oct 10:00.
    assert.equal(patientCancelDeadlineLabel("2026-10-10T07:00:00Z", 24), "Friday, 9 October 2026 at 10:00");
  });
});
