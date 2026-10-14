import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildBookingPanelClinics } from "../../lib/public/profile-booking-panel";
import type { ProfileClinicCard } from "../../lib/public/profile-clinic-cards";

/**
 * Public profile, the booking column (user, 2026-10-13): "Choose a clinic" on top, then one
 * card for the chosen clinic with its details, its month and its times. The details form
 * opens as a dialog with "What to expect" beside it.
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

  it("is the clinic card of the booking column: one clinic, with its address, hours, phone and map", () => {
    assert.match(page, /<ProfileBookingPanel\b/);
    assert.match(page, /panelClinics\.find\(\(clinic\) => clinic\.selected\)/);
    assert.match(panel, /data-testid="profile-clinic-selected"/);
    assert.match(panel, /bookingT\("bookingAtClinic"\)/);
    assert.match(panel, /<RevealPhoneButton\b/);
    assert.match(panel, /t\("openInMaps"\)/);
    assert.match(panel, /data-testid="profile-clinic-hours"/);
    // The clinic choice is its own block above the card, not a list inside it.
    assert.doesNotMatch(panel, /\?location=/);
    // It scrolls with the page: no box that scrolls inside itself.
    assert.doesNotMatch(panel, /overflow-y-auto/);
  });

  it("one colour for \"chosen\" and \"do this\": the CTA colour (navy in light, teal in dark; user, 2026-10-14)", () => {
    const chooser = read("components/doctor/profile/ProfileClinicChooser.tsx");
    // The chosen clinic row and its radio dot, like the chosen day and time and Continue.
    assert.match(chooser, /\$\{ROW_CLASS\} border-accent-cta/);
    assert.match(chooser, /rounded-full bg-accent-cta/);
    assert.match(chooser, /"border-accent-cta" : "border-profile-muted"/);
    assert.doesNotMatch(chooser, /border-accent bg-accent-soft|rounded-full bg-accent"/);
    // Call is a secondary action, outlined like Open in Maps: Continue is the main one.
    const callClass = panel.slice(panel.indexOf("<RevealPhoneButton"), panel.indexOf("/>", panel.indexOf("<RevealPhoneButton")));
    assert.doesNotMatch(callClass, /\bbg-accent\b/);
    assert.match(callClass, /border-2 border-profile-muted/);
  });

  it("the calendar in the card is the month, above the times, then Continue", () => {
    assert.match(page, /layout="panel"/);
    const cardLayout = booking.slice(booking.search(/\n  if \(panel\) \{/));
    assert.ok(cardLayout.indexOf("{monthPicker}") < cardLayout.indexOf("{timesBlock}"));
    assert.ok(cardLayout.indexOf("{timesBlock}") < cardLayout.indexOf('t("continueButton")'));
    assert.doesNotMatch(booking, /booking-day-chip|booking-more-dates/);
    for (const file of ["messages/en.json", "messages/el.json"]) {
      const messages = JSON.parse(read(file));
      assert.equal(typeof messages.BookingPage.allTimesInCyprus, "string", file);
      for (const key of ["nextFree", "callToBook"]) {
        assert.equal(typeof messages.DoctorProfilePage[key], "string", `${file} ${key}`);
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
