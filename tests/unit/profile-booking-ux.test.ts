import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  PROFILE_SELECT_SERVICE_EVENT,
  parseProfileServiceSelectDetail,
} from "../../lib/public/profile-booking-events";

/**
 * UX pass over the public profile and its booking form (user, 2026-10-11): the email step is told
 * up front, every error shows at once, the calendar opens on a day with times, the install banner
 * stays off the profile, "Continue" instead of "Confirm", steps that add up, the clinic picker
 * steps aside while the details are filled in, and each service has its own Book button.
 */

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");
const messages = (locale: "en" | "el") => JSON.parse(read(`messages/${locale}.json`));

describe("profile booking events", () => {
  it("a service pick carries the service id", () => {
    assert.equal(PROFILE_SELECT_SERVICE_EVENT, "doccy:profile-select-service");
    assert.equal(parseProfileServiceSelectDetail({ serviceId: "6a1f8a52-2b8f-4c1e-9d55-0f3c2a7b9e10" }), "6a1f8a52-2b8f-4c1e-9d55-0f3c2a7b9e10");
    assert.equal(parseProfileServiceSelectDetail({ serviceId: "" }), null);
    assert.equal(parseProfileServiceSelectDetail({ serviceId: 7 }), null);
    assert.equal(parseProfileServiceSelectDetail(null), null);
  });
});

describe("what to expect tells about the email step", () => {
  it("has the email step between sending and the professional's review", () => {
    const card = read("components/doctor/WhatToExpectCard.tsx");
    const leads = [...card.matchAll(/lead: "(whatToExpectStep\d+Lead)"/g)].map((m) => m[1]);
    assert.equal(leads.length, 4);
    for (const locale of ["en", "el"] as const) {
      const page = messages(locale).DoctorProfilePage;
      for (const lead of leads) assert.ok(page[lead], `${locale} ${lead}`);
    }
    const en = messages("en").DoctorProfilePage;
    assert.match(en.whatToExpectStep2Body, /email/i);
    assert.match(en.whatToExpectStep2Body, /30 minutes/);
  });
});

describe("booking form wording and steps", () => {
  const en = messages("en").BookingPage;
  const booking = read("components/doctor/BookingSection.tsx");

  it("the button after picking a time is Continue (the request is sent later)", () => {
    assert.equal(en.continueButton, "Continue");
    assert.match(booking, /t\("continueButton"\)/);
    assert.equal(/>\s*Confirm\s*</.test(booking), false);
  });

  it("steps add up: 1 and 2 of 2 (choosing the clinic is not a step of its own)", () => {
    assert.equal(en.chooseClinicStep, undefined);
    assert.equal(en.pickTimeStep, "Step 1 of 2");
    assert.equal(en.detailsStep, "Step 2 of 2");
    assert.match(booking, /t\("detailsStep"\)/);
  });

  it("a clinic's next free time is picked for the patient; Continue opens the form (user, 2026-10-13)", () => {
    // The chosen clinic's row goes back to its next free time...
    assert.match(booking, /parseProfileSlotSelectDetail\(/);
    const chooser = read("components/doctor/profile/ProfileClinicChooser.tsx");
    assert.match(chooser, /requestProfileDaySelect\(row\.dateKey, row\.slotKey\)/);
    // ...and the calendar opens with it picked, without opening the form by itself.
    const handler = booking.slice(booking.indexOf("const onSelectDay"), booking.indexOf("PROFILE_SELECT_DAY_EVENT, onSelectDay"));
    assert.match(handler, /setShowContactForm\(false\)/);
    assert.doesNotMatch(handler, /setShowContactForm\(true\)/);
    assert.match(booking, /if \(panel\) \{[\s\S]*?if \(first\) setSelectedSlot\(first\);/);
  });

  it("Greek has every new key", () => {
    const el = messages("el").BookingPage;
    for (const key of ["continueButton", "detailsStep", "bookingForService"]) assert.ok(el[key], key);
  });
});

describe("booking form behaviour", () => {
  const booking = read("components/doctor/BookingSection.tsx");

  it("shows every error at once and takes the patient to the first", () => {
    assert.match(booking, /allBookingFormErrors\(/);
    assert.equal(booking.includes("firstBookingFormError("), false);
    assert.match(booking, /focusField\(problems\[0\]\.field\)/);
  });

  it("opens the calendar on the first day with times, and a picked day stays picked", () => {
    assert.match(booking, /<DayPicker[\s\S]*?\brequired\b/);
    assert.match(booking, /availableDates\[0\]/);
  });

  it("tells the clinic picker which step the patient is on, in the same task the form appears", () => {
    // A layout effect through a shared context: an event let the picker hide after the scroll
    // target was measured, and the page stopped short of the form.
    assert.match(booking, /useIsomorphicLayoutEffect\(\(\) => \{\s*setBookingStep\(/);
    assert.equal(booking.includes("announceProfileBookingStep"), false);
  });

  it("a service's own Book button picks that service in the form", () => {
    assert.match(booking, /PROFILE_SELECT_SERVICE_EVENT/);
    assert.match(booking, /parseProfileServiceSelectDetail\(/);
  });
});

describe("profile page pieces", () => {
  it("services are a price list: one card, one row per service, the whole row books (user, 2026-10-14)", () => {
    const services = read("components/doctor/profile/ProfileServicesSection.tsx");
    assert.match(services, /<ProfileServiceBookButton\b/);
    // One card of rows with thin lines between them, across the column: no two-column grid of cards.
    assert.match(services, /divide-y divide-profile-border/);
    assert.doesNotMatch(services, /sm:grid-cols-2/);
    // After six, "Show all N services".
    assert.match(services, /<ProfileShowAll\b/);
    assert.match(services, /SERVICES_SHOWN = 6/);
    assert.match(services, /t\("servicesShowAll", \{ count: services\.length \}\)/);
    const showAll = read("components/doctor/profile/ProfileShowAll.tsx");
    assert.match(showAll, /aria-expanded/);
    // The hidden rows stay in the page (search engines, find in page), only hidden.
    assert.match(showAll, /nth-child/);
    for (const file of ["messages/en.json", "messages/el.json"]) {
      const messages = JSON.parse(read(file)).DoctorProfilePage;
      assert.match(messages.servicesShowAll, /#|\{count\}/, file);
    }
    const button = read("components/doctor/profile/ProfileServiceBookButton.tsx");
    assert.match(button, /requestProfileServiceSelect\(/);
    assert.match(button, /href=\{`#\$\{PROFILE_SECTION_IDS\.book\}`\}/);
    // The row is the link: name, price, and an arrow that becomes "Book" on hover or focus.
    assert.match(button, /children/);
    assert.match(button, /group-hover\/service:/);
    assert.doesNotMatch(button, /rounded-xl border-2/);
  });

  it("one clinic chooser, drawn as a pick-one list; the older pickers are gone", () => {
    for (const gone of ["DoctorProfileClinicPicker.tsx", "profile/ProfileClinicSwitch.tsx", "profile/HideWhileBookingDetails.tsx"]) {
      assert.equal(fs.existsSync(path.join(repoRoot, "components/doctor", gone)), false, gone);
    }
    const chooser = read("components/doctor/profile/ProfileClinicChooser.tsx");
    assert.match(chooser, /data-testid="profile-clinic-chooser"/);
    assert.match(chooser, /aria-current="true"/);
    // Every row is as tall as the tallest (user, 2026-10-13).
    assert.match(chooser, /auto-rows-fr/);
    // "Next free" once, over the column of times, not on every row (user, 2026-10-14).
    assert.equal((chooser.match(/labels\.nextFree/g) ?? []).length, 1);
    const heading = chooser.slice(chooser.indexOf("<h2"), chooser.indexOf("<ul"));
    assert.match(heading, /labels\.nextFree/);
    // Nothing to choose with a single clinic.
    assert.match(chooser, /if \(rows\.length < 2\) return null;/);
    const page = read("lib/public/doctor-profile-page.tsx");
    assert.match(page, /<ProfileClinicChooser[\s\S]*<ProfileBookingStepProvider>[\s\S]*<BookingSection[\s\S]*<\/ProfileBookingStepProvider>/);
  });

  it("the install banner stays off the profile page", () => {
    const page = read("lib/public/doctor-profile-page.tsx");
    assert.match(page, /<HideInstallBanner\b/);
    const banner = read("components/pwa/InstallBanner.tsx");
    assert.match(banner, /html\[data-doccy-hide-install-banner\]/);
    const hide = read("components/pwa/HideInstallBanner.tsx");
    assert.match(hide, /data-doccy-hide-install-banner/);
  });
});

describe("profile polish round (user, 2026-10-14)", () => {
  it("no 11-12px text left in the booking column: 13px at least", () => {
    const chooser = read("components/doctor/profile/ProfileClinicChooser.tsx");
    assert.doesNotMatch(chooser, /text-xs/);
    const css = read("app/globals.css");
    const head = css.slice(css.indexOf(".rdp-profile .rdp-head_cell {"));
    assert.match(head.slice(0, head.indexOf("}")), /font-size: 0\.8125rem/);
    const booking = read("components/doctor/BookingSection.tsx");
    assert.match(booking, /<p className="text-\[13px\] text-profile-muted">\{t\("allTimesInCyprus"\)\}<\/p>/);
    for (const file of ["ProfileSchemeToggle", "ProfileShareButton"]) {
      assert.doesNotMatch(read(`components/doctor/profile/${file}.tsx`), /text-xs/, file);
    }
  });

  it("the hero's small links and Show all get a finger-sized tap area", () => {
    const page = read("lib/public/doctor-profile-page.tsx");
    const heroLink = page.slice(page.indexOf("const heroLinkClass"), page.indexOf("return (", page.indexOf("const heroLinkClass")));
    assert.match(heroLink, /relative after:absolute after:-inset-x-1 after:-inset-y-3 after:content-\[''\]/);
    // The fold-away wrappers only clip on a laptop, so the larger tap area is not cut on a phone.
    assert.doesNotMatch(page, /min-h-0 overflow-hidden"/);
    assert.match(page, /min-h-0 lg:overflow-hidden/);
    const showAll = read("components/doctor/profile/ProfileShowAll.tsx");
    assert.match(showAll, /inline-flex min-h-11 items-center/);
  });

  it("the tab highlight follows the section filling the screen, and moves quickly", () => {
    const nav = read("components/doctor/profile/ProfileSectionNav.tsx");
    assert.match(nav, /ACTIVE_LINE_RATIO = 0\.35/);
    assert.match(nav, /after:duration-150/);
    assert.doesNotMatch(nav, /after:duration-300/);
  });

  it("the header's join button is navy on teal, readable (WCAG AA)", () => {
    const header = read("components/finder/FinderPublicHeader.tsx");
    const join = header.slice(header.indexOf("const joinLinkClass"), header.indexOf(";", header.indexOf("const joinLinkClass")));
    assert.match(join, /bg-clinical-500/);
    assert.match(join, /text-ink-900/);
    assert.doesNotMatch(join, /text-white|hover:bg-clinical-600/);
  });

  it("clicking a service opens the details form with it chosen when a time is picked", () => {
    const events = read("lib/public/profile-booking-events.ts");
    assert.match(events, /export function requestProfileServiceSelect\(serviceId: string\): boolean/);
    assert.match(events, /cancelable: true/);
    const button = read("components/doctor/profile/ProfileServiceBookButton.tsx");
    // The form opened: no jump to the calendar.
    assert.match(button, /if \(!requestProfileServiceSelect\(serviceId\)\) event\.preventDefault\(\)/);
    const booking = read("components/doctor/BookingSection.tsx");
    const handler = booking.slice(booking.indexOf("const onSelectService"), booking.indexOf("window.addEventListener(PROFILE_SELECT_SERVICE_EVENT"));
    assert.match(handler, /if \(panel && selectedSlot\) \{\s*setShowContactForm\(true\);\s*event\.preventDefault\(\);/);
    // The form says which service, at the top, next to the time and the clinic.
    assert.match(booking, /data-testid="booking-form-service"/);
  });
});
