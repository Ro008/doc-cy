import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BOOKING_SLOT_QUERY,
  bookingSlotDateFromKey,
  buildDoctorBookingHref,
  parseBookingSlotParam,
} from "../../lib/booking-slot-param";

describe("booking-slot-param", () => {
  it("parses valid Cyprus slot keys", () => {
    assert.equal(parseBookingSlotParam("2026-08-14T10:00"), "2026-08-14T10:00");
    assert.equal(parseBookingSlotParam(" 2026-08-14T09:30 "), "2026-08-14T09:30");
  });

  it("rejects invalid slot keys", () => {
    assert.equal(parseBookingSlotParam(null), null);
    assert.equal(parseBookingSlotParam(""), null);
    assert.equal(parseBookingSlotParam("2026-08-14"), null);
    assert.equal(parseBookingSlotParam("2026-08-14T10:00:00"), null);
    assert.equal(parseBookingSlotParam("14/08/2026T10:00"), null);
  });

  it("builds profile href with optional slot query", () => {
    assert.equal(buildDoctorBookingHref("andreas-nikos"), "/andreas-nikos");
    assert.equal(
      buildDoctorBookingHref("andreas-nikos", "2026-08-14T10:00"),
      `/andreas-nikos?${BOOKING_SLOT_QUERY}=2026-08-14T10%3A00`,
    );
    assert.equal(buildDoctorBookingHref("andreas-nikos", "nope"), "/andreas-nikos");
  });

  it("derives local Date from slot key", () => {
    const d = bookingSlotDateFromKey("2026-08-14T10:00");
    assert.ok(d);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 7);
    assert.equal(d.getDate(), 14);
  });
});
