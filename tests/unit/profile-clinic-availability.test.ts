import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PublicAvailabilityDay } from "../../lib/public/compute-public-booking-slots";
import { clinicChooserRows, widestBookingHorizonDays } from "../../lib/public/profile-clinic-availability";

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

describe("clinicChooserRows", () => {
  const base = { locale: "en", slug: "maria" };

  it("lists every clinic in her order, each with its next free time and a link that chooses it", () => {
    const rows = clinicChooserRows({
      ...base,
      clinics: [
        { ...pegeia, days: [day("2026-10-14", []), day("2026-10-15", ["11:15", "12:00"])] },
        { ...mall, days: [day("2026-10-14", ["09:00"])] },
        { ...limassol, days: [day("2026-10-14", ["09:00", "09:30"], true)] },
      ],
      selectedId: "loc-1",
      bookingOffEverywhere: false,
    });
    assert.deepEqual(
      rows.map((row) => [row.id, row.title, row.place, row.selected, row.bookable, row.next?.dateKey, row.next?.fromTime, row.href]),
      [
        ["loc-1", "Malama Machaira", "Pegeia", true, true, "2026-10-15", "11:15", "/en/maria?location=loc-1"],
        ["loc-2", "Kings Avenue Mall", "Paphos", false, false, undefined, undefined, "/en/maria?location=loc-2"],
        ["loc-3", "Iliaxtida", "Mesa Geitonia", false, true, "2026-10-14", "09:00", "/en/maria?location=loc-3"],
      ],
    );
    assert.equal(rows[2].next?.isToday, true);
  });

  it("keeps a clinic with online booking off in the list: the patient can still look and call", () => {
    const rows = clinicChooserRows({
      ...base,
      clinics: [{ ...mall, days: [day("2026-10-14", ["09:00"])] }, { ...pegeia, days: [] }],
      selectedId: "loc-2",
      bookingOffEverywhere: false,
    });
    assert.deepEqual(rows.map((row) => [row.id, row.selected, row.bookable, row.next]), [
      ["loc-2", true, false, null],
      ["loc-1", false, true, null],
    ]);
  });

  it("marks every clinic as not bookable when her access has ended", () => {
    const rows = clinicChooserRows({
      ...base,
      locale: "el",
      clinics: [{ ...pegeia, days: [day("2026-10-14", ["09:00"])] }, { ...limassol, days: [] }],
      selectedId: null,
      bookingOffEverywhere: true,
    });
    assert.deepEqual(rows.map((row) => [row.bookable, row.next, row.selected]), [
      [false, null, false],
      [false, null, false],
    ]);
    assert.equal(rows[0].href, "/el/maria?location=loc-1");
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
