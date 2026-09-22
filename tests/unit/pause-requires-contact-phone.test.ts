import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), "utf8");

describe("settings: pausing online bookings requires a contact phone", () => {
  it("SettingsForm derives the requirement from every clinic and feeds both cards", () => {
    const form = read("components/dashboard/SettingsForm.tsx");
    assert.equal(form.includes("contactPhoneState"), true);
    assert.equal(form.includes("@/lib/booking-contact-phone"), true);
    // The requirement is account-wide: it looks at the pause flag of every workplace.
    assert.match(form, /pauseFlags:\s*workplaces\.map\(/);
    assert.equal(form.includes("pausingRequiresPhone"), true);
    assert.equal(form.includes("lockedOnWhilePaused"), true);
  });

  it("the pause toggle explains the consequence and can collect a number inline", () => {
    const toggle = read("components/dashboard/OnlineBookingsPauseToggle.tsx");
    assert.equal(toggle.includes("onSaveContactPhone"), true);
    assert.equal(toggle.includes("contactCallNumber"), true);
    assert.equal(toggle.includes("phoneRequiredNow"), true);
    assert.equal(toggle.includes("pausingRequiresPhone"), true);
    // An input to type the number right where the decision is made.
    assert.match(toggle, /type="tel"/);
    // And it must not fire the pause request before that number is saved.
    assert.match(toggle, /needsContactPhone|contactPhonePrompt/);
  });

  it("the Call switch is locked on while no clinic accepts online bookings", () => {
    const phones = read("components/dashboard/PhoneNumbersSettings.tsx");
    assert.equal(phones.includes("lockedOnWhilePaused"), true);
    assert.match(phones, /disabled=\{[^}]*lockedOn/);
  });
});

describe("api: pause route enforces a reachable phone", () => {
  const route = read("app/api/doctor-online-bookings/route.ts");

  it("refuses to pause the last bookable clinic when the account has no phone", () => {
    assert.equal(route.includes("@/lib/booking-contact-phone"), true);
    assert.equal(route.includes("CONTACT_PHONE_REQUIRED_CODE"), true);
    assert.equal(route.includes("pauseFlagsAfterChange"), true);
  });

  it("does not write the public Call flag: a paused clinic reveals the phone on read", () => {
    assert.equal(route.includes("show_phone_public"), false);
  });
});

describe("api: public phone route backs the inline prompt and the lock", () => {
  const route = read("app/api/doctor-settings/public-phone/route.ts");

  it("accepts a number typed from the pause prompt", () => {
    assert.equal(route.includes("normalizeContactPhone"), true);
    // It must actually persist the number, not just parse it.
    assert.match(route, /\.update\(\{\s*mobile_number: newCallNumber/);
  });

  it("refuses to hide the Call button while online bookings are unavailable", () => {
    assert.equal(route.includes("anyClinicPaused"), true);
    assert.equal(route.includes("CALL_LOCKED_WHILE_PAUSED_CODE"), true);
  });
});

describe("the number cannot be emptied from the main settings save either", () => {
  it("the form refuses to submit a blank public number while every clinic is paused", () => {
    const form = read("components/dashboard/SettingsForm.tsx");
    assert.equal(form.includes("CONTACT_PHONE_REQUIRED_MESSAGE"), true);
  });

  it("the settings route enforces the same invariant server side", () => {
    const route = read("app/api/doctor-settings/route.ts");
    assert.equal(route.includes("@/lib/booking-contact-phone"), true);
    assert.equal(route.includes("anyClinicPaused"), true);
    assert.equal(route.includes("CONTACT_PHONE_REQUIRED_CODE"), true);
  });
});

describe("a paused clinic reveals the phone on the public read path", () => {
  it("the profile page and the reveal API both pass the clinic pause flags", () => {
    for (const file of [
      "lib/public/doctor-profile-page.tsx",
      "app/api/directory/contact-reveal/route.ts",
    ]) {
      assert.match(read(file), /pauseFlags:/, `${file} must pass pauseFlags`);
    }
  });

  it("the finder card reveals the phone for a paused professional too", () => {
    // Third read path: the finder decided on show_phone_public alone, so a professional
    // who never configured anything had no Call button on the card either.
    const loader = read("lib/public/load-finder-registered-public-call.ts");
    assert.equal(loader.includes("publicPhoneForProfessional"), true);
    assert.equal(loader.includes("loadDoctorLocationsByDoctorIds"), true);
    assert.match(loader, /pauseFlags:/);
  });

  it("the settings page no longer writes the flag on load", () => {
    const page = read("app/agenda/settings/page.tsx");
    assert.equal(page.includes("shouldRevealPublicPhone"), false);
    assert.equal(page.includes("show_phone_public: true"), false);
  });
});

describe("public profile: a paused calendar points the patient at the phone", () => {
  it("BookingSection takes the phone availability and uses the call hint", () => {
    const section = read("components/doctor/BookingSection.tsx");
    assert.equal(section.includes("publicPhoneAvailable"), true);
    assert.equal(section.includes("appointmentsPausedCallHint"), true);
  });

  it("the hint is translated in every locale", () => {
    for (const locale of ["en", "el"]) {
      const messages = JSON.parse(read(`messages/${locale}.json`));
      assert.equal(
        typeof messages.BookingPage.appointmentsPausedCallHint,
        "string",
        `missing appointmentsPausedCallHint in ${locale}`,
      );
    }
  });

  it("the profile page passes the phone it already resolved", () => {
    const page = read("lib/public/doctor-profile-page.tsx");
    assert.match(page, /publicPhoneAvailable=\{hasPublicPhone\}/);
  });
});
