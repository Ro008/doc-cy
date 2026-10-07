import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { agendaBookingSourceFromRaw, isManualBooking, MANUAL_BOOKING_LABEL } from "../../lib/agenda-booking-source";

/** How the agenda tells a manual booking from an online one (user, 2026-10-07). */
describe("isManualBooking", () => {
  it("is true only for manual", () => {
    assert.equal(isManualBooking("manual"), true);
    assert.equal(isManualBooking("MANUAL"), true);
    assert.equal(isManualBooking("online"), false);
    assert.equal(isManualBooking(null), false);
    assert.equal(isManualBooking(undefined), false);
    assert.equal(isManualBooking(""), false);
  });
});

describe("agendaBookingSourceFromRaw", () => {
  it("keeps online and manual, drops anything else", () => {
    assert.equal(agendaBookingSourceFromRaw("manual"), "manual");
    assert.equal(agendaBookingSourceFromRaw("online"), "online");
    assert.equal(agendaBookingSourceFromRaw(null), null);
    assert.equal(agendaBookingSourceFromRaw(7), null);
    assert.equal(agendaBookingSourceFromRaw("walk-in"), null);
  });
});

describe("MANUAL_BOOKING_LABEL", () => {
  it("is the one wording used everywhere", () => {
    assert.equal(MANUAL_BOOKING_LABEL, "Manual booking");
  });
});
