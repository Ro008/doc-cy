import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PublicAvailabilityDay } from "../../lib/public/compute-public-booking-slots";
import {
  clinicNextAvailabilityRows,
  nextAvailabilityRowHref,
  widestBookingHorizonDays,
} from "../../lib/public/profile-clinic-availability";

function day(dateKey: string, times: string[], isToday = false): PublicAvailabilityDay {
  return {
    dateKey,
    weekdayLabel: "MON",
    dateLabel: "5 Oct",
    isToday,
    slots: times.map((timeLabel) => ({ slotKey: `${dateKey}T${timeLabel}`, timeLabel })),
  };
}

const pegeia = { id: "loc-1", title: "Malama Machaira", place: "Pegeia", paused: false };
const mall = { id: "loc-2", title: "Kings Avenue Mall", place: "Paphos", paused: true };
const limassol = { id: "loc-3", title: "Iliaxtida", place: "Mesa Geitonia", paused: false };

describe("clinicNextAvailabilityRows", () => {
  it("gives one row per clinic that takes online bookings, with its first free time", () => {
    const rows = clinicNextAvailabilityRows({
      clinics: [
        { ...pegeia, days: [day("2026-10-14", []), day("2026-10-15", ["11:15", "12:00"])] },
        { ...mall, days: [day("2026-10-14", ["09:00"])] },
        { ...limassol, days: [day("2026-10-14", ["09:00", "09:30"], true)] },
      ],
      selectedId: "loc-1",
      bookingOffEverywhere: false,
    });
    assert.deepEqual(
      rows.map((row) => [row.locationId, row.title, row.place, row.selected, row.next?.dateKey, row.next?.fromTime]),
      [
        ["loc-1", "Malama Machaira", "Pegeia", true, "2026-10-15", "11:15"],
        ["loc-3", "Iliaxtida", "Mesa Geitonia", false, "2026-10-14", "09:00"],
      ],
    );
    assert.equal(rows[1].next?.isToday, true);
  });

  it("keeps her own clinic order, not soonest first", () => {
    const rows = clinicNextAvailabilityRows({
      clinics: [
        { ...pegeia, days: [day("2026-10-20", ["09:00"])] },
        { ...limassol, days: [day("2026-10-14", ["09:00"])] },
      ],
      selectedId: null,
      bookingOffEverywhere: false,
    });
    assert.deepEqual(rows.map((row) => row.locationId), ["loc-1", "loc-3"]);
  });

  it("keeps a bookable clinic with no free time, without a time", () => {
    const rows = clinicNextAvailabilityRows({
      clinics: [{ ...pegeia, days: [day("2026-10-14", [])] }],
      selectedId: "loc-1",
      bookingOffEverywhere: false,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].next, null);
  });

  it("has no rows when her access has ended or every clinic is paused", () => {
    assert.deepEqual(
      clinicNextAvailabilityRows({
        clinics: [{ ...pegeia, days: [day("2026-10-14", ["09:00"])] }],
        selectedId: "loc-1",
        bookingOffEverywhere: true,
      }),
      [],
    );
    assert.deepEqual(
      clinicNextAvailabilityRows({
        clinics: [{ ...mall, days: [day("2026-10-14", ["09:00"])] }],
        selectedId: "loc-2",
        bookingOffEverywhere: false,
      }),
      [],
    );
  });
});

describe("nextAvailabilityRowHref", () => {
  it("stays on the page for the clinic already chosen", () => {
    assert.equal(
      nextAvailabilityRowHref({ locale: "en", slug: "maria", locationId: "loc-1", selected: true }),
      "#book",
    );
  });

  it("switches clinic and lands on the calendar for another one", () => {
    assert.equal(
      nextAvailabilityRowHref({ locale: "el", slug: "maria", locationId: "loc 3", selected: false }),
      "/el/maria?location=loc%203#book",
    );
  });
});

describe("widestBookingHorizonDays", () => {
  it("is the longest horizon among her clinics, so busy times are known for all of them", () => {
    assert.equal(widestBookingHorizonDays([14, 180, 30]), 180);
  });

  it("falls back to 90 days for a missing or unknown value", () => {
    assert.equal(widestBookingHorizonDays([]), 90);
    assert.equal(widestBookingHorizonDays([7, null, undefined]), 90);
    assert.equal(widestBookingHorizonDays([14, 45]), 90);
  });
});
