import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isManualBookingSlotTaken } from "../../lib/manual-booking-slots";

const NOW = Date.parse("2026-09-30T08:00:00Z");
const CLINIC_1 = "clinic-1";
const CLINIC_2 = "clinic-2";

describe("isManualBookingSlotTaken", () => {
  it("blocks a time booked in another clinic (one professional, one agenda)", () => {
    const appointments = [
      {
        id: "a",
        status: "REQUESTED",
        appointment_datetime: "2026-09-30T12:30:00Z",
        duration_minutes: 30,
        location_id: CLINIC_1,
      },
    ];
    assert.equal(
      isManualBookingSlotTaken("2026-09-30T12:30:00Z", 30, appointments, NOW),
      true,
    );
  });

  it("blocks a slot that only partly overlaps a longer visit", () => {
    const appointments = [
      {
        id: "a",
        status: "CONFIRMED",
        appointment_datetime: "2026-09-30T12:00:00Z",
        duration_minutes: 45,
        location_id: CLINIC_2,
      },
    ];
    assert.equal(
      isManualBookingSlotTaken("2026-09-30T12:30:00Z", 30, appointments, NOW),
      true,
    );
    assert.equal(
      isManualBookingSlotTaken("2026-09-30T13:00:00Z", 30, appointments, NOW),
      false,
    );
  });

  it("blocks when the new visit runs into the next one", () => {
    const appointments = [
      {
        id: "a",
        status: "CONFIRMED",
        appointment_datetime: "2026-09-30T13:00:00Z",
        duration_minutes: 30,
        location_id: CLINIC_1,
      },
    ];
    assert.equal(
      isManualBookingSlotTaken("2026-09-30T12:30:00Z", 45, appointments, NOW),
      true,
    );
    assert.equal(
      isManualBookingSlotTaken("2026-09-30T12:30:00Z", 30, appointments, NOW),
      false,
    );
  });

  it("frees the original time of a counter-offer but holds its live proposed times", () => {
    const appointments = [
      {
        id: "a",
        status: "NEEDS_RESCHEDULE",
        appointment_datetime: "2026-10-08T07:00:00Z",
        duration_minutes: 30,
        proposed_slots: ["2026-10-08T08:00:00Z"],
        proposal_expires_at: "2026-10-02T09:00:00Z",
        location_id: null,
      },
    ];
    assert.equal(
      isManualBookingSlotTaken("2026-10-08T07:00:00Z", 30, appointments, NOW),
      false,
    );
    assert.equal(
      isManualBookingSlotTaken("2026-10-08T08:00:00Z", 30, appointments, NOW),
      true,
    );
  });

  it("ignores cancelled and declined visits", () => {
    const appointments = ["CANCELLED", "DECLINED", "EXPIRED"].map((status, i) => ({
      id: String(i),
      status,
      appointment_datetime: "2026-09-30T12:30:00Z",
      duration_minutes: 30,
      location_id: CLINIC_1,
    }));
    assert.equal(
      isManualBookingSlotTaken("2026-09-30T12:30:00Z", 30, appointments, NOW),
      false,
    );
  });
});
