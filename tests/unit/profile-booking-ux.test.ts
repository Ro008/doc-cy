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

  it("steps add up: 1, 2 and 3 of 3 with several clinics", () => {
    assert.equal(en.chooseClinicStep, "Step 1 of 3");
    assert.equal(en.pickTimeStep, "Step 2 of 3");
    assert.equal(en.detailsStep, "Step 3 of 3");
    assert.match(booking, /t\("detailsStep"\)/);
  });

  it("the clinic card says Book here (not 'Tap to') on every device", () => {
    assert.equal(en.tapToBookHere, "Book here");
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
  it("each service has a Book button", () => {
    const services = read("components/doctor/profile/ProfileServicesSection.tsx");
    assert.match(services, /<ProfileServiceBookButton\b/);
    const button = read("components/doctor/profile/ProfileServiceBookButton.tsx");
    assert.match(button, /requestProfileServiceSelect\(/);
    assert.match(button, /href=\{`#\$\{PROFILE_SECTION_IDS\.book\}`\}/);
  });

  it("the clinic picker steps aside while the details are filled in", () => {
    const picker = read("components/doctor/DoctorProfileClinicPicker.tsx");
    assert.match(picker, /<HideWhileBookingDetails\b/);
    const hide = read("components/doctor/profile/HideWhileBookingDetails.tsx");
    assert.match(hide, /useProfileBookingStep\(\)/);
    assert.match(hide, /hidden=\{step === "details"\}/);
    const page = read("lib/public/doctor-profile-page.tsx");
    assert.match(page, /<ProfileBookingStepProvider>[\s\S]*<DoctorProfileClinicPicker[\s\S]*<BookingSection[\s\S]*<\/ProfileBookingStepProvider>/);
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
