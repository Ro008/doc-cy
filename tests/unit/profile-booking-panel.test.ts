import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildBookingPanelClinics } from "../../lib/public/profile-booking-panel";
import type { ProfileClinicCard } from "../../lib/public/profile-clinic-cards";

/**
 * Public profile, step 2 of the new layout (user, 2026-10-13): one booking panel on the right
 * that stays on screen: her clinics to choose from, the chosen clinic's details and its times.
 * The details form opens as a dialog. On a phone the panel comes first, in the page.
 */

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

const card = (key: string, extra: Partial<ProfileClinicCard> = {}): ProfileClinicCard => ({
  key,
  title: `Clinic ${key}`,
  address: `${key} Street`,
  mapsUrl: `https://maps.example/${key}`,
  isBookingHere: false,
  phoneClinicId: `phone-${key}`,
  ...extra,
});

describe("buildBookingPanelClinics", () => {
  const hours = { a: [{ days: "Mon–Fri", hours: "09:00–17:00" }] };

  it("lists her clinics in order, with the chosen one marked and each one's details", () => {
    const clinics = buildBookingPanelClinics({
      locations: [
        { id: "a", town: "Pegeia", district: "Paphos", pause_online_bookings: false },
        { id: "b", town: "", district: "Limassol", pause_online_bookings: true },
      ],
      cards: [card("a"), card("b", { phoneClinicId: null })],
      openingHours: hours,
      selectedId: "b",
      bookingOffEverywhere: false,
    });
    assert.deepEqual(
      clinics.map((c) => [c.id, c.selected, c.place, c.bookingOff, c.selectable]),
      [
        ["a", false, "Pegeia", false, true],
        ["b", true, "Limassol", true, true],
      ],
    );
    assert.equal(clinics[0].title, "Clinic a");
    assert.equal(clinics[0].address, "a Street");
    assert.equal(clinics[0].mapsUrl, "https://maps.example/a");
    assert.equal(clinics[0].phoneClinicId, "phone-a");
    assert.deepEqual(clinics[0].hours, hours.a);
    assert.deepEqual(clinics[1].hours, []);
    assert.equal(clinics[1].phoneClinicId, null);
  });

  it("a single clinic is the chosen one, whatever the URL says", () => {
    const clinics = buildBookingPanelClinics({
      locations: [{ id: "a", town: "Pegeia", district: "Paphos" }],
      cards: [card("a")],
      openingHours: {},
      selectedId: null,
      bookingOffEverywhere: false,
    });
    assert.equal(clinics.length, 1);
    assert.equal(clinics[0].selected, true);
  });

  it("online booking off everywhere (her access ended) marks every clinic", () => {
    const clinics = buildBookingPanelClinics({
      locations: [
        { id: "a", pause_online_bookings: false },
        { id: "b", pause_online_bookings: false },
      ],
      cards: [card("a"), card("b")],
      openingHours: {},
      selectedId: "a",
      bookingOffEverywhere: true,
    });
    assert.deepEqual(clinics.map((c) => c.bookingOff), [true, true]);
  });

  it("with no clinic rows, shows the cards there are (an address or a phone), not selectable", () => {
    const clinics = buildBookingPanelClinics({
      locations: [],
      cards: [card("profile-address", { phoneClinicId: null })],
      openingHours: {},
      selectedId: null,
      bookingOffEverywhere: false,
    });
    assert.equal(clinics.length, 1);
    assert.equal(clinics[0].selected, true);
    assert.equal(clinics[0].selectable, false);
    assert.equal(clinics[0].address, "profile-address Street");
  });

  it("skips a clinic that has no card, rather than showing an empty row", () => {
    const clinics = buildBookingPanelClinics({
      locations: [{ id: "a" }, { id: "ghost" }],
      cards: [card("a")],
      openingHours: {},
      selectedId: "a",
      bookingOffEverywhere: false,
    });
    assert.deepEqual(clinics.map((c) => c.id), ["a"]);
  });
});

describe("the booking panel on the page", () => {
  const page = read("lib/public/doctor-profile-page.tsx");
  const panel = read("components/doctor/profile/ProfileBookingPanel.tsx");
  const booking = read("components/doctor/BookingSection.tsx");

  it("is the page's booking area: it stays on screen on a wide screen, and comes first on a phone", () => {
    assert.match(panel, /id=\{PROFILE_SECTION_IDS\.book\}/);
    assert.match(panel, /lg:sticky/);
    // Taller than the screen: it scrolls inside itself instead of losing its end.
    assert.match(panel, /lg:max-h-\[calc\(100vh-[^\]]+\)\]/);
    assert.match(panel, /lg:overflow-y-auto/);
    assert.match(page, /<ProfileBookingPanel\b/);
    assert.match(page, /lg:grid-cols-\[minmax\(0,1fr\)_380px\]/);
    // In the code the panel comes before the sections (a phone shows it first).
    assert.ok(page.indexOf("<ProfileBookingPanel") < page.indexOf("<ProfileAboutSection"));
  });

  it("offers each clinic as a link, and shows the chosen clinic's address, hours, phone and map", () => {
    assert.match(panel, /data-testid="profile-clinic-picker"/);
    assert.match(panel, /\?location=\$\{encodeURIComponent\(clinic\.id\)\}/);
    assert.match(panel, /aria-current="true"/);
    assert.match(panel, /<RevealPhoneButton\b/);
    assert.match(panel, /t\("openInMaps"\)/);
    assert.match(panel, /data-testid="profile-clinic-hours"/);
    assert.match(panel, /bookingT\("onlineBookingOff"\)/);
  });

  it("the hero no longer repeats the next days, and the old three-card clinic picker is not on the page", () => {
    assert.doesNotMatch(page, /<ProfileNextAvailability\b/);
    assert.doesNotMatch(page, /<DoctorProfileClinicPicker\b/);
  });

  it("the calendar in the panel is a strip of days, with the month behind \"More dates\"", () => {
    assert.match(page, /layout="panel"/);
    assert.match(booking, /data-testid="booking-day-chip"/);
    assert.match(booking, /data-testid="booking-more-dates"/);
    assert.match(booking, /t\("moreDates"\)/);
    for (const file of ["messages/en.json", "messages/el.json"]) {
      const messages = JSON.parse(read(file)).BookingPage;
      for (const key of ["moreDates", "fewerDates"]) {
        assert.equal(typeof messages[key], "string", `${file} ${key}`);
      }
    }
  });

  it("the details form and the \"check your email\" card open as a dialog over the page", () => {
    assert.match(booking, /<ProfileBookingDialog\b/);
    const dialog = read("components/doctor/profile/ProfileBookingDialog.tsx");
    assert.match(dialog, /role="dialog"/);
    assert.match(dialog, /aria-modal="true"/);
    assert.match(dialog, /Escape/);
    // Drawn inside the profile, so it keeps its light or dark colours.
    assert.match(dialog, /createPortal\(/);
    assert.match(dialog, /\.doccy-profile/);
    // "What to expect" moved next to the form.
    assert.match(page, /detailsAside=\{<WhatToExpectCard \/>\}/);
  });
});
