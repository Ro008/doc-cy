import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  finderPopupChooserRows,
  finderPopupInitialClinicId,
  type FinderPopupClinic,
} from "../../lib/finder-profile-popup";
import { bookingPropsForSettingsRow } from "../../lib/public/professional-booking-props";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8").replace(/\r\n/g, "\n");

function clinic(id: string, over: Partial<FinderPopupClinic> = {}): FinderPopupClinic {
  return {
    id,
    title: `Clinic ${id}`,
    place: "Paphos",
    bookable: true,
    next: { day: "Fri 16 Oct", time: "09:00", dateKey: "2026-10-16", slotKey: "2026-10-16T09:00" },
    booking: {
      weeklySlots: [],
      breakStart: undefined,
      breakEnd: undefined,
      onlineBookingsPaused: false,
      holidayModeEnabled: false,
      holidayStartDate: null,
      holidayEndDate: null,
      bookingHorizonDays: 90,
      minimumNoticeHours: 2,
    },
    publicPhoneAvailable: true,
    ...over,
  };
}

describe("the profile pop-up's clinics (mockup F; user, 2026-10-17)", () => {
  it("opens on the card's clinic when she has it", () => {
    const clinics = [clinic("a"), clinic("b")];
    assert.equal(finderPopupInitialClinicId(clinics, "b"), "b");
  });

  it("an unknown or missing clinic falls back to her first bookable clinic, then her first", () => {
    const clinics = [clinic("a", { bookable: false, next: null }), clinic("b")];
    assert.equal(finderPopupInitialClinicId(clinics, "zz"), "b");
    assert.equal(finderPopupInitialClinicId(clinics, null), "b");
    const none = [clinic("a", { bookable: false, next: null }), clinic("b", { bookable: false, next: null })];
    assert.equal(finderPopupInitialClinicId(none, null), "a");
    assert.equal(finderPopupInitialClinicId([], "a"), null);
  });

  it("Choose a clinic marks the chosen one and keeps her clinic order", () => {
    const rows = finderPopupChooserRows([clinic("a"), clinic("b", { bookable: false, next: null })], "b");
    assert.deepEqual(
      rows.map((row) => [row.id, row.selected, row.bookable, row.day, row.time]),
      [
        ["a", false, true, "Fri 16 Oct", "09:00"],
        ["b", true, false, null, null],
      ],
    );
  });
});

describe("one set of booking props for the profile and the pop-up", () => {
  const row = {
    professional_id: "p",
    monday: true,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false,
    start_time: "09:00:00",
    end_time: "12:00:00",
    weekly_schedule: null,
    break_start: "10:00:00",
    break_end: "10:30:00",
    pause_online_bookings: false,
    holiday_mode_enabled: true,
    holiday_start_date: "2026-12-01",
    holiday_end_date: "2026-12-10",
    booking_horizon_days: 30,
    minimum_notice_hours: 4,
    slot_duration_minutes: 30,
  };

  it("the clinic's schedule, break, limits and her holiday", () => {
    const props = bookingPropsForSettingsRow(row, { accessEnded: false });
    assert.equal(props.breakStart, "10:00");
    assert.equal(props.breakEnd, "10:30");
    assert.equal(props.bookingHorizonDays, 30);
    assert.equal(props.minimumNoticeHours, 4);
    assert.equal(props.holidayModeEnabled, true);
    assert.equal(props.holidayStartDate, "2026-12-01");
    assert.equal(props.onlineBookingsPaused, false);
    assert.ok(props.weeklySlots.length > 0);
  });

  it("a paused clinic, or her access ended, takes no online bookings", () => {
    assert.equal(bookingPropsForSettingsRow({ ...row, pause_online_bookings: true }, { accessEnded: false }).onlineBookingsPaused, true);
    assert.equal(bookingPropsForSettingsRow(row, { accessEnded: true }).onlineBookingsPaused, true);
  });

  it("the profile page uses the same helper", () => {
    assert.match(read("lib/public/doctor-profile-page.tsx"), /bookingPropsForSettingsRow\(/);
  });
});

describe("GET /api/directory/professional-booking", () => {
  const route = () => read("app/api/directory/professional-booking/route.ts");

  it("is rate limited, read fresh, and only for a live registered professional", () => {
    const source = route();
    assert.match(source, /enforcePublicApiRateLimit\(req, "professionalBooking"/);
    assert.match(source, /export const dynamic = "force-dynamic"/);
    const loader = read("lib/public/finder-profile-popup-data.ts");
    assert.match(loader, /\.eq\("is_registered", true\)/);
    assert.match(loader, /\.eq\("is_archived", false\)/);
    assert.match(loader, /createServiceRoleClient\(\{ fresh: true \}\)/);
    // What her profile shows, nothing more: no contact columns.
    assert.doesNotMatch(loader, /registration_email|mobile_number|\bemail\b/);
    assert.match(read("lib/public-api-rate-limit.ts"), /professionalBooking: \{ limit: \d+/);
  });

  it("says when a signed-in professional is looking (no booking for them)", () => {
    assert.match(route(), /bookingViewerMode\(/);
  });
});

describe("every link to more about her on a card opens the pop-up (user, 2026-10-17)", () => {
  it("the name and the photo", () => {
    const hero = read("components/finder/FinderProfileCardHero.tsx");
    assert.match(hero, /<FinderPopupLink\b[\s\S]*?\{name\}/);
    assert.doesNotMatch(hero, /<PendingLink\b/);
  });

  it("a time on the card opens the booking form over the Finder, All times and View profile the pop-up", () => {
    const strip = read("components/finder/FinderCardDayStrip.tsx");
    assert.doesNotMatch(strip, /PendingLink/);
    assert.match(strip, /<FinderPopupLink[\s\S]*?slotKey=\{slot\.slotKey\}/);
    assert.match(strip, /<FinderPopupLink[\s\S]*?>\s*All times\s*</);
    assert.match(strip, /<FinderPopupLink[\s\S]*?>\s*View profile\s*</);
  });

  it("the link is a real link (new tab, no JavaScript) that opens the pop-up on a plain click", () => {
    const popup = read("components/finder/FinderProfilePopup.tsx");
    assert.match(popup, /export function FinderPopupLink\b/);
    assert.match(popup, /event\.metaKey \|\| event\.ctrlKey \|\| event\.shiftKey/);
    assert.match(popup, /event\.preventDefault\(\)/);
  });

  it("the Finder gives each registered card its professional", () => {
    const page = read("app/finder/[[...filters]]/page.tsx");
    assert.match(page, /<FinderProfilePopupProvider\b/);
    assert.match(page, /<FinderCardPopupScope\b/);
  });
});

describe("the pop-up (mockup F, teal band kept: user, 2026-10-17)", () => {
  const popup = () => read("components/finder/FinderProfilePopup.tsx");

  it("her hero on the teal band, Open full profile, her services as chips", () => {
    const source = popup();
    assert.match(source, /data-testid="finder-profile-popup"/);
    assert.match(source, /bg-accent\b/);
    assert.match(source, />\s*Open full profile\s*</);
    assert.match(source, /requestProfileServiceSelect\(/);
    assert.match(source, /data-testid="finder-popup-services"/);
  });

  it("the profile's own calendar and booking form, in the panel layout", () => {
    const source = popup();
    assert.match(source, /<BookingSection\b[\s\S]*?layout="panel"/);
    assert.match(source, /initialSlotKey=\{/);
    assert.match(source, /onTimesStale=\{/);
  });

  it("Back closes the pop-up; the page under it does not move", () => {
    const source = popup();
    assert.match(source, /window\.history\.pushState\(/);
    assert.match(source, /addEventListener\("popstate"/);
    assert.match(source, /window\.history\.back\(\)/);
  });

  it("fills the screen on a phone", () => {
    assert.match(popup(), /max-sm:min-h-full/);
  });

  it("the booking form can refresh the pop-up's times instead of the page", () => {
    const booking = read("components/doctor/BookingSection.tsx");
    assert.match(booking, /onTimesStale\?: \(\) => void/);
    assert.match(booking, /if \(onTimesStale\) onTimesStale\(\);\s*else router\.refresh\(\);/);
  });
});
