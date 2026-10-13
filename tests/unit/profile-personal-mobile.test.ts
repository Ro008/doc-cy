import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  personalMobileDisplay,
  personalMobileTelHref,
  publicPersonalMobile,
} from "../../lib/public/profile-personal-mobile";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

/**
 * The professional's personal mobile on her public profile (user, 2026-10-13): only when
 * she switched "Show on my profile" on, in the hero behind a "Show mobile" button, never
 * in the page's HTML before the click. The clinic's phone stays the main public phone.
 */
describe("publicPersonalMobile", () => {
  const shown = {
    professional: { mobile_number: "+35799123456", is_registered: true, is_archived: false },
    settings: { show_mobile_on_profile: true },
  };

  it("is her mobile when she is registered, has one and switched it on", () => {
    assert.equal(publicPersonalMobile(shown.professional, shown.settings), "+35799123456");
    assert.equal(
      publicPersonalMobile({ ...shown.professional, mobile_number: "  +35799123456 " }, shown.settings),
      "+35799123456",
    );
  });

  it("is nothing while the switch is off, which is the default", () => {
    assert.equal(publicPersonalMobile(shown.professional, { show_mobile_on_profile: false }), null);
    assert.equal(publicPersonalMobile(shown.professional, { show_mobile_on_profile: null }), null);
    assert.equal(publicPersonalMobile(shown.professional, {}), null);
    assert.equal(publicPersonalMobile(shown.professional, null), null);
  });

  it("is nothing without a saved mobile", () => {
    for (const mobile_number of [null, undefined, "", "   "]) {
      assert.equal(publicPersonalMobile({ ...shown.professional, mobile_number }, shown.settings), null);
    }
  });

  it("is nothing for a listing, an archived professional or an unknown one", () => {
    assert.equal(publicPersonalMobile({ ...shown.professional, is_registered: false }, shown.settings), null);
    assert.equal(publicPersonalMobile({ ...shown.professional, is_registered: null }, shown.settings), null);
    assert.equal(publicPersonalMobile({ ...shown.professional, is_archived: true }, shown.settings), null);
    assert.equal(publicPersonalMobile(null, shown.settings), null);
  });
});

describe("personalMobileDisplay / personalMobileTelHref", () => {
  it("writes the number the way its country does, with the country code", () => {
    assert.equal(personalMobileDisplay("+35799123456"), "+357 99 123456");
    assert.equal(personalMobileDisplay("+306912345678"), "+30 691 234 5678");
    assert.equal(personalMobileDisplay("+447911123456"), "+44 7911 123456");
  });

  it("leaves a number it cannot read as stored", () => {
    assert.equal(personalMobileDisplay("12345"), "12345");
    assert.equal(personalMobileDisplay(""), "");
  });

  it("dials the full international number", () => {
    assert.equal(personalMobileTelHref("+35799123456"), "tel:+35799123456");
    assert.equal(personalMobileTelHref("+357 99 123456"), "tel:+35799123456");
    assert.equal(personalMobileTelHref(""), null);
    assert.equal(personalMobileTelHref("abc"), null);
  });
});

describe("reveal route: POST /api/directory/professional-mobile-reveal", () => {
  const route = read("app/api/directory/professional-mobile-reveal/route.ts");
  const loader = read("lib/public/load-profile-personal-mobile.ts");

  it("shares the phone-reveal rate limit and reads through the service role", () => {
    assert.match(route, /enforcePublicApiRateLimit\(req, "contactReveal"/);
    assert.match(route, /createServiceRoleClient\(\)/);
    assert.match(route, /loadPublicPersonalMobile\(/);
  });

  it("answers the same 404 whether she hid it, has none or does not exist", () => {
    assert.match(route, /reason: "not_found" \}, \{ status: 404 \}/);
    assert.equal((route.match(/status: 404/g) ?? []).length, 1);
  });

  it("the loader decides with publicPersonalMobile from her row and her switch", () => {
    assert.doesNotMatch(loader, /"use client"/);
    assert.match(loader, /publicPersonalMobile\(/);
    assert.match(loader, /mobile_number, is_registered, is_archived/);
    assert.match(loader, /show_mobile_on_profile/);
  });

  it("the clinic reveal route still knows nothing about mobiles", () => {
    assert.equal(read("app/api/directory/contact-reveal/route.ts").includes("mobile_number"), false);
  });
});

describe("profile hero: Show mobile", () => {
  const page = read("lib/public/doctor-profile-page.tsx");
  const button = read("components/doctor/profile/RevealMobileButton.tsx");

  it("the page learns only whether there is a mobile to show, never the number", () => {
    assert.match(page, /const hasPersonalMobile = Boolean\(await loadPublicPersonalMobile\(supabase, profile\.id\)\)/);
    assert.equal(page.includes("mobile_number"), false);
    assert.equal((page.match(/loadPublicPersonalMobile\(/g) ?? []).length, 1);
  });

  it("shows the button in the hero's facts row, only when she switched it on", () => {
    assert.match(page, /\{hasPersonalMobile \? \(\s*<RevealMobileButton\b/);
    const facts = page.indexOf("<FinderDistrictLink");
    const mobile = page.indexOf("<RevealMobileButton");
    const languages = page.indexOf('t("speaksLabel")');
    assert.ok(facts > 0 && facts < mobile && mobile < languages, "after the district, before the languages");
    assert.match(page, /label=\{t\("heroShowMobile"\)\}/);
  });

  it("the clinic count is gone from the hero: the clinic picker and the tab already say it", () => {
    assert.equal(page.includes("profile-hero-clinics-link"), false);
    assert.equal(page.includes("heroClinicsCount"), false);
    assert.equal(page.includes("heroClinicDetails"), false);
    for (const file of ["messages/en.json", "messages/el.json"]) {
      const messages = read(file);
      assert.equal(messages.includes("heroClinicsCount"), false, file);
      assert.equal(messages.includes("heroClinicDetails"), false, file);
      assert.equal(messages.includes('"heroShowMobile"'), true, file);
    }
  });

  it("the button fetches the number on click and turns into a link that dials it", () => {
    assert.match(button, /"use client"/);
    assert.match(button, /fetch\("\/api\/directory\/professional-mobile-reveal"/);
    assert.match(button, /method: "POST"/);
    assert.match(button, /personalMobileTelHref\(/);
    assert.match(button, /personalMobileDisplay\(/);

  });

  it("shows once, in the hero: the clinic card is about the clinic (user, 2026-10-13)", () => {
    // "Clinics & contact" is off the page; the hero stays on screen on a wide page.
    assert.equal((page.match(/<RevealMobileButton\b/g) ?? []).length, 1);
    const clinicCard = read("components/doctor/profile/ProfileBookingPanel.tsx");
    assert.equal(clinicCard.includes("RevealMobileButton"), false);
    assert.equal(clinicCard.includes("mobile_number"), false);
    assert.match(page, /testId="profile-hero-mobile"/);
    assert.match(button, /data-testid=\{testId\}/);
    for (const file of ["messages/en.json", "messages/el.json"]) {
      assert.equal(read(file).includes('"clinicsShowMobile"'), true, file);
    }
  });

  it("the mobile is never in the structured data", () => {
    assert.equal(read("lib/public/profile-structured-data.ts").includes("mobile"), false);
  });
});
