import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bookingRefusal, BOOKING_SLOT_REFRESH_MS } from "../../lib/booking-refusal";

describe("bookingRefusal", () => {
  it("turns a time that became too soon into a plain message and back to the calendar", () => {
    assert.deepEqual(bookingRefusal(400, "minimum_notice"), { messageKey: "slotTooSoon", backToCalendar: true });
  });

  it("sends the patient back to the calendar when the time is no longer offered", () => {
    for (const code of ["outside_hours", "not_aligned", "beyond_horizon", "holiday"]) {
      assert.deepEqual(bookingRefusal(400, code), { messageKey: "slotNoLongerAvailable", backToCalendar: true }, code);
    }
  });

  it("keeps the existing answers for a taken time and an open request", () => {
    assert.deepEqual(bookingRefusal(409, "slot_taken"), { messageKey: "timeSlotJustBooked", backToCalendar: true });
    assert.deepEqual(bookingRefusal(409, "open_request_exists"), { messageKey: "openRequestExists", backToCalendar: false });
  });

  it("leaves anything else to the server's own message", () => {
    assert.equal(bookingRefusal(400, "invalid_service"), null);
    assert.equal(bookingRefusal(500, undefined), null);
  });

  it("refreshes the offered times every minute", () => {
    assert.equal(BOOKING_SLOT_REFRESH_MS, 60_000);
  });
});
