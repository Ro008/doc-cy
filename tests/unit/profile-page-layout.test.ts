import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

describe("public profile: one page with anchor tabs", () => {
  const page = read("lib/public/doctor-profile-page.tsx");

  it("themes the page root with the doctor's accent", () => {
    assert.match(page, /className="doccy-profile[^"]*"/);
    assert.match(page, /style=\{profileThemeStyle\(customization\.accent\)\}/);
    assert.match(page, /profileCustomizationFromRow\(profile\)/);
  });

  it("renders every section on the page behind sticky anchor tabs", () => {
    assert.match(page, /<ProfileSectionNav\b/);
    for (const component of ["ProfileAboutSection", "ProfileServicesSection", "ProfileClinicsSection"]) {
      assert.match(page, new RegExp(`<${component}\\b`), component);
    }
    const sectionsDir = path.join(repoRoot, "components/doctor/profile");
    const all = [
      page,
      ...fs.readdirSync(sectionsDir).map((file) => read(`components/doctor/profile/${file}`)),
    ].join("\n");
    for (const id of ["book", "about", "services", "clinics"]) {
      assert.match(all, new RegExp(`id=\\{PROFILE_SECTION_IDS\\.${id}\\}`), `section #${id}`);
    }
  });

  it("shows the bio openly instead of inside a collapsed accordion", () => {
    assert.equal(page.includes("DoctorDetailsAccordion"), false);
  });

  it("has no language switcher while the Greek copy is not reviewed", () => {
    assert.equal(page.includes("LanguageSwitcher"), false);
  });

  it("hero: what is clickable looks clickable, languages are the finder's colour chips", () => {
    // District links to the finder, the clinic count jumps to #clinics.
    assert.match(page, /<FinderDistrictLink[\s\S]*?className="[^"]*underline[^"]*"/);
    assert.match(page, /data-testid="profile-hero-clinics-link"[\s\S]*?href=\{`#\$\{PROFILE_SECTION_IDS\.clinics\}`\}|href=\{`#\$\{PROFILE_SECTION_IDS\.clinics\}`\}[\s\S]*?data-testid="profile-hero-clinics-link"/);
    // Same language chips as the finder cards.
    assert.match(page, /languageThemeForLabel\(/);
    assert.match(page, /\.pillClass/);
    // No "Show phone" / "Directions" buttons: the clinics section has each clinic's.
    assert.equal(page.includes("heroShowPhone"), false);
    assert.equal(page.includes("heroDirections"), false);
  });

  it("ends with an About DocCy link to the professionals page", () => {
    assert.match(page, /href="\/for-professionals"[\s\S]*?t\("aboutDocCy"\)/);
    assert.equal(page.includes('t("poweredBy")'), false);
  });

  it("fades the bottom edge while the page continues below (as on the dashboard)", () => {
    assert.match(page, /<ProfileScrollFade\b/);
    const fade = read("components/doctor/profile/ProfileScrollFade.tsx");
    assert.match(fade, /data-testid="profile-scroll-fade"/);
    assert.match(fade, /data-visible=/);
    // Painted with the page background, so it works in light and dark.
    assert.match(fade, /var\(--p-bg\)/);
  });

  it("fades the tabs' edge on small screens when more tabs sit off to the side", () => {
    const nav = read("components/doctor/profile/ProfileSectionNav.tsx");
    assert.match(nav, /data-overflow-end=/);
    assert.match(nav, /mask-image/);
  });

  it("points search engines at the profile itself, not the home page", () => {
    // Registered profiles inherited the root layout's canonical "/" (2026-10-02).
    const registeredMeta = page.slice(page.indexOf("const dynamicTitle"));
    assert.match(registeredMeta, /alternates:\s*\{\s*canonical:\s*canonicalUrl\s*\}/);
    assert.match(page, /const canonicalUrl = `\$\{siteBaseUrl\(\)\}\$\{publicProfessionalProfilePath\(params\.slug\)\}`/);
  });

  it("adds the industry basics: breadcrumbs, opening hours, mobile book bar, share, report", () => {
    assert.match(page, /<ProfileBreadcrumbs\b/);
    assert.match(page, /buildProfileStructuredData\(/);
    assert.match(page, /clinicOpeningHours\(/);
    assert.match(page, /<ProfileMobileBookBar\b/);
    assert.match(page, /<ProfileShareButton\b/);
    assert.match(page, /<ProfileReportLink\b/);
    const clinics = read("components/doctor/profile/ProfileClinicsSection.tsx");
    assert.match(clinics, /openingHours/);
  });

  it("hero names every district with a clinic, each a link", () => {
    assert.match(page, /profileDistricts\(/);
    assert.match(page, /districts\.map\(/);
  });

  it("services show the price with the euro sign, no EUR note", () => {
    const services = read("components/doctor/profile/ProfileServicesSection.tsx");
    assert.match(services, /formatServicePrice\(/);
    assert.equal(services.includes("servicesHint"), false);
  });

  it("Confirm opens the details form at its top", () => {
    const booking = read("components/doctor/BookingSection.tsx");
    assert.match(booking, /contactFormRef/);
    assert.match(booking, /block: "start"/);
  });

  it("checks the email like /register: valid format and 'Did you mean …?' for typos", () => {
    const booking = read("components/doctor/BookingSection.tsx");
    assert.match(booking, /suggestRegisterEmail\(/);
    assert.match(booking, /isValidRegisterEmail\(/);
    assert.match(booking, /data-testid="booking-email-suggestion"/);
  });

  it("booking form: every field required and marked, in the profile's colours", () => {
    const booking = read("components/doctor/BookingSection.tsx");
    // Gender and date of birth come from master (stored since 2026-10-04).
    assert.match(booking, /firstBookingFormError\(/);
    assert.match(booking, /id="patientBirthdate"/);
    // Required marker on every field label (name, email, phone, first visit, gender, birth date, reason).
    assert.ok((booking.match(/<RequiredMark \/>/g) ?? []).length >= 7);
    assert.match(booking, /tone="profile"/);
    assert.equal(/\b(?:ink|clinical|amber)-\d/.test(booking), false);
  });

  it("brings the Confirm button into view when a time is picked", () => {
    const booking = read("components/doctor/BookingSection.tsx");
    assert.match(booking, /confirmBarRef/);
    assert.match(booking, /scrollIntoView\(/);
    assert.match(booking, /prefers-reduced-motion: reduce/);
  });

  it("puts next availability in the hero", () => {
    assert.match(page, /<ProfileNextAvailability\b/);
    assert.match(page, /computePublicAvailabilityCalendar\(/);
  });

  it("lets a next-availability day open that day in the booking calendar", () => {
    const booking = read("components/doctor/BookingSection.tsx");
    assert.match(booking, /PROFILE_SELECT_DAY_EVENT/);
    assert.match(booking, /parseProfileDaySelectDetail/);
  });
});

describe("public profile: colours, dark mode and motion", () => {
  const css = read("app/globals.css");

  it("opens in light and lets anyone switch to dark, remembered in a cookie", () => {
    assert.match(css, /\.doccy-profile\s*\{/);
    assert.match(css, /\.doccy-profile\[data-scheme="dark"\]/);
    // Light by default: the device setting no longer decides.
    assert.equal(/prefers-color-scheme/.test(css), false);
    const page = read("lib/public/doctor-profile-page.tsx");
    assert.match(page, /parseProfileScheme\(cookies\(\)\.get\(PROFILE_SCHEME_COOKIE\)\?\.value\)/);
    assert.match(page, /data-scheme=\{scheme\}/);
    assert.match(page, /<ProfileSchemeToggle\b/);
    const toggle = read("components/doctor/profile/ProfileSchemeToggle.tsx");
    assert.match(toggle, /profileSchemeCookie\(/);
    assert.match(toggle, /aria-pressed/);
    assert.match(toggle, /dataset\.scheme/);
  });

  it("turns every profile animation off for people who reduce motion", () => {
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*\.doccy-profile/);
  });

  it("animates with meaning: one live dot, entrances once, feedback on choice", () => {
    assert.match(css, /@keyframes profile-pulse/);
    assert.match(css, /@keyframes profile-rise/);
    assert.match(css, /\.profile-live-dot/);
    assert.match(css, /\.profile-rise/);
    const next = read("components/doctor/profile/ProfileNextAvailability.tsx");
    // The pulsing dot only exists when today really has a free time.
    assert.match(next, /hasAvailabilityToday\(/);
    assert.match(next, /profile-live-dot/);
    const booking = read("components/doctor/BookingSection.tsx");
    assert.match(booking, /profile-rise/);
    const nav = read("components/doctor/profile/ProfileSectionNav.tsx");
    // Scroll spy: a clicked tab stays marked while its smooth scroll runs, and the
    // end of the page marks the last section (short sections can't reach the top).
    assert.match(nav, /addEventListener\("scroll"/);
    assert.match(nav, /clickLockRef/);
    assert.match(nav, /atBottom/);
    assert.match(nav, /aria-current/);
  });

  it("exposes the palette to Tailwind as tokens", () => {
    const tailwind = read("tailwind.config.ts");
    assert.match(tailwind, /profile:\s*\{/);
    assert.match(tailwind, /"var\(--p-surface\)"/);
    assert.match(tailwind, /accent:\s*\{/);
    assert.match(tailwind, /"var\(--p-accent\)"/);
  });
});

describe("doctor settings: your public page", () => {
  it("offers colour + headline with a light/dark preview and the pending-backend notice", () => {
    const settings = read("components/dashboard/ProfilePageCustomization.tsx");
    assert.match(settings, /PROFILE_ACCENT_IDS/);
    assert.match(settings, /PROFILE_HEADLINE_MAX_LENGTH/);
    assert.match(settings, /saveProfileCustomization/);
    assert.match(settings, /data-scheme=\{previewScheme\}/);
    assert.match(settings, /EXPECTED TO FAIL until Livio builds PATCH \/api\/professional-profile-customization/);
    const page = read("app/agenda/settings/page.tsx");
    assert.match(page, /<ProfilePageCustomization\b/);
  });
});
