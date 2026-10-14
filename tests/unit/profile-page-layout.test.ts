import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

describe("public profile: one page with anchor tabs", () => {
  const page = read("lib/public/doctor-profile-page.tsx");

  it("themes the page root with DocCy's colours, the same on every profile", () => {
    assert.match(page, /className="doccy-profile[^"]*"/);
    assert.match(page, /style=\{profileThemeStyle\(\)\}/);
    assert.doesNotMatch(page, /customization\.accent/);
    assert.match(page, /loadProfileHeadline\(supabase, profile\.id\)/);
  });

  it("renders every section on the page behind sticky anchor tabs", () => {
    assert.match(page, /<ProfileSectionNav\b/);
    for (const component of ["ProfileAboutSection", "ProfileServicesSection", "ProfileReviewsSection"]) {
      assert.match(page, new RegExp(`<${component}\\b`), component);
    }
    const sectionsDir = path.join(repoRoot, "components/doctor/profile");
    const all = [
      page,
      ...fs.readdirSync(sectionsDir).map((file) => read(`components/doctor/profile/${file}`)),
    ].join("\n");
    for (const id of ["book", "about", "services", "reviews"]) {
      assert.match(all, new RegExp(`id=\\{PROFILE_SECTION_IDS\\.${id}\\}`), `section #${id}`);
    }
  });

  it("shows the bio openly instead of inside a collapsed accordion", () => {
    assert.equal(page.includes("DoctorDetailsAccordion"), false);
  });

  it("has no language switcher while the Greek copy is not reviewed", () => {
    assert.equal(page.includes("LanguageSwitcher"), false);
  });

  it("hero: what is clickable looks clickable, languages are one calm chip", () => {
    // District links to the finder; no clinic count (the picker and the tab say it; user, 2026-10-13).
    assert.match(page, /<FinderDistrictLink[\s\S]*?className="[^"]*underline[^"]*"/);
    assert.equal(page.includes("profile-hero-clinics-link"), false);
    // Hero links take the hero's text colour, never the default link teal (2026-10-10).
    assert.match(page, /className=\{`text-accent-on \$\{heroLinkClass\}`\}/);
    // One chip for every language, in the hero's own text colour (user, 2026-10-13).
    assert.match(page, /canonicalLanguageLabel\(/);
    assert.match(page, /LANGUAGE_CHIP_ON_ACCENT/);
    assert.doesNotMatch(page, /languageThemeForLabel|\.pillClass/);
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
    // Flush on the professional's tab bar, as on the dashboard: a gap left it floating as a
    // translucent band over sharp content (user, 2026-10-10).
    // The dashboard's fade is the shared ScrollFade component (moved out of DoctorDashboard in master).
    const dashboard = read("components/navigation/ScrollFade.tsx");
    const offset = /bottom-\[calc\((\d+(?:\.\d+)?)rem\+env\(safe-area-inset-bottom,0px\)\)\]/;
    assert.equal(fade.match(offset)?.[1], dashboard.match(offset)?.[1]);
  });

  it("the sticky tabs are frosted glass, solid where blur or transparency isn't wanted", () => {
    const nav = read("components/doctor/profile/ProfileSectionNav.tsx");
    assert.match(nav, /profile-glass/);
    const css = read("app/globals.css");
    assert.match(css, /\.profile-glass\s*\{[\s\S]*?backdrop-filter:/);
    assert.match(css, /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)/);
    assert.match(css, /prefers-reduced-transparency: reduce/);
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
    const clinicCard = read("components/doctor/profile/ProfileBookingPanel.tsx");
    assert.match(clinicCard, /data-testid="profile-clinic-hours"/);
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
    assert.match(booking, /allBookingFormErrors\(/);
    // 2026-10-10: first and last name, birth date as Day / Month / Year, mobile with a fixed
    // dial code and an example number.
    assert.match(booking, /id="firstName"/);
    assert.match(booking, /id="lastName"/);
    assert.match(booking, /fullPatientName\(/);
    assert.match(booking, /id="patientBirthdate-day"/);
    assert.match(booking, /inputMode="numeric"/);
    assert.match(booking, /fixedDialCode/);
    // Required marker on every field label (name, email, phone, first visit, gender, birth date, reason).
    assert.ok((booking.match(/<RequiredMark \/>/g) ?? []).length >= 7);
    assert.match(booking, /tone="profile"/);
    assert.equal(/\b(?:ink|clinical|amber)-\d/.test(booking), false);
  });

  it("asks which of her services the visit is for, or Other with free text", () => {
    const booking = read("components/doctor/BookingSection.tsx");
    assert.match(booking, /<select\s+id="professionalService"/);
    assert.match(booking, /bookingServiceOptions\(/);
    assert.match(booking, /bookingServiceRequest\(/);
    // The free text is always there: optional with a service, required with Other or no services.
    assert.equal(booking.includes("showReasonField"), false);
    assert.match(booking, /reasonOptional/);
    // The page passes ids and names only: no prices in the picker.
    assert.match(page, /services=\{services\.map\(\(\{ id, name \}\) => \(\{ id, name \}\)\)\}/);
  });

  it("brings the Confirm button into view when a time is picked", () => {
    const booking = read("components/doctor/BookingSection.tsx");
    assert.match(booking, /confirmBarRef/);
    assert.match(booking, /scrollIntoView\(/);
    assert.match(booking, /prefers-reduced-motion: reduce/);
  });

  it("shows each clinic's next free time in \"Choose a clinic\"", () => {
    assert.match(page, /<ProfileClinicChooser\b/);
    assert.match(page, /clinicChooserRows\(/);
    assert.match(page, /computePublicAvailabilityCalendar\(/);
    // Her busy times are loaded far enough ahead for the clinic with the longest horizon.
    assert.match(page, /widestBookingHorizonDays\(/);
    const chooser = read("components/doctor/profile/ProfileClinicChooser.tsx");
    assert.match(chooser, /rows\.map\(/);
    assert.match(chooser, /data-location/);
    // The hero is about her: no availability card or "Request appointment" button in it.
    assert.doesNotMatch(page, /<ProfileNextAvailability\b/);
  });

  it("two columns on a wide page: hero and tabs stay on screen, so does the clinic choice (user, 2026-10-13)", () => {
    assert.match(page, /lg:grid-cols-\[minmax\(0,1fr\)_380px\]/);
    // The hero and the tabs are one pinned block; the sections scroll under it.
    assert.match(page, /data-profile-pin\s+className="[^"]*lg:sticky[^"]*lg:top-0/);
    assert.ok(page.indexOf("data-profile-pin") < page.indexOf("<ProfileSectionNav"));
    assert.ok(page.indexOf("<ProfileSectionNav") < page.indexOf("data-profile-sections"));
    // The whole booking column stays on screen (user, 2026-10-14): pinned at the top when it
    // fits, and by its bottom edge when it is taller than the screen, so Continue is always
    // visible. No scrollbar of its own.
    assert.match(page, /<ProfileStickyColumn\b/);
    assert.doesNotMatch(page, /className="[^"]*lg:sticky[^"]*"\s*>\s*<ProfileClinicChooser/);
    const column = read("components/doctor/profile/ProfileStickyColumn.tsx");
    assert.match(column, /--profile-book-h/);
    assert.match(column, /ResizeObserver/);
    assert.match(column, /lg:sticky/);
    assert.match(column, /lg:self-start/);
    assert.match(column, /lg:top-\[min\(0px,calc\(100vh_-_var\(--profile-book-h/);
    assert.doesNotMatch(column, /overflow-y-auto/);
    // Scrolling back up brings its top (the clinic rows) back right away, not only at the page top.
    assert.match(column, /addEventListener\("scroll"/);
    assert.match(column, /lastScrollY/);
    // On a phone: hero, booking column, tabs, sections.
    assert.match(page, /<header className="order-1 /);
    assert.match(page, /testId="profile-booking-column"\s+className="order-2 /);
    assert.match(page, /data-profile-sections className="order-4 /);
    const nav = read("components/doctor/profile/ProfileSectionNav.tsx");
    assert.match(nav, /order-3/);
    // A tab's section stops below the pinned block, whatever its height.
    assert.match(nav, /--profile-pin-h/);
    const css = read("app/globals.css");
    assert.match(css, /\[data-profile-sections\] > section \{\s*scroll-margin-top: calc\(var\(--profile-pin-h/);
    // No tab for the booking column or the clinics: they are always next to the sections.
    assert.match(page, /hasClinics: false/);
    assert.match(page, /tab\.id !== PROFILE_SECTION_IDS\.book/);
  });

  it("the pinned hero shrinks to photo, name and specialties after the first scroll (user, 2026-10-14)", () => {
    const nav = read("components/doctor/profile/ProfileSectionNav.tsx");
    // The tabs mark the pinned block compact once the page has scrolled, and back at the top.
    assert.match(nav, /data-compact|dataset\.compact/);
    assert.match(nav, /COMPACT_AFTER_PX/);
    assert.match(nav, /EXPAND_BELOW_PX/);
    // The hero reads the mark through a named group.
    assert.match(page, /data-profile-pin\s+className="[^"]*group\/pin/);
    assert.match(page, /group-data-\[compact\]\/pin:h-12/);
    // The rest (headline, districts, rating, languages) folds away.
    assert.match(page, /data-hero-more/);
    assert.match(page, /group-data-\[compact\]\/pin:grid-rows-\[0fr\]/);
  });

  it("lets a next-availability day open that day in the booking calendar", () => {
    const booking = read("components/doctor/BookingSection.tsx");
    assert.match(booking, /PROFILE_SELECT_DAY_EVENT/);
    assert.match(booking, /parseProfileDaySelectDetail/);
  });
});

describe("public profile: colours, dark mode and motion", () => {
  const css = read("app/globals.css");

  it("the top bar's logo follows the mode: white \"my\" on the dark bar, as on the dashboard", () => {
    const header = read("components/finder/FinderPublicHeader.tsx");
    // Both artworks are drawn; the mode switches on the page without a reload, so CSS picks.
    assert.match(header, /<DocCyWordmark\s+variant="light"[^>]*\[\.doccy-profile\[data-scheme=dark\]_&\]:hidden/);
    assert.match(header, /<DocCyWordmark\s+variant="dark"[^>]*hidden \[\.doccy-profile\[data-scheme=dark\]_&\]:inline-flex/);
  });

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

describe("doctor settings: headline", () => {
  it("offers the headline, saved through the customization route, with the too-often words as a toast", () => {
    const settings = read("components/dashboard/ProfileHeadlineCard.tsx");
    assert.match(settings, /PROFILE_HEADLINE_MAX_LENGTH/);
    assert.match(settings, /saveProfileCustomization/);
    assert.match(settings, /result\.reason === "too_often"/);
    assert.doesNotMatch(settings, /EXPECTED TO FAIL|pending_backend|backend_pending/);
    // Settings moved to /settings (#279); the card sits in its Profile section.
    const page = read("app/settings/page.tsx");
    assert.match(page, /<ProfileHeadlineCard\b/);
  });

  it("offers no page colour and no light/dark: the colour is DocCy's, the mode is the visitor's (user, 2026-10-13)", () => {
    assert.equal(fs.existsSync(path.join(repoRoot, "components/dashboard/ProfilePageCustomization.tsx")), false);
    const settings = read("components/dashboard/ProfileHeadlineCard.tsx");
    assert.doesNotMatch(settings, /accent|data-scheme|doccy-profile|previewScheme|Page colour|Live preview/i);
  });

  it("looks like the other settings cards: shared card, eyebrow, buttons, busy and toast rules", () => {
    const settings = read("components/dashboard/ProfileHeadlineCard.tsx");
    assert.match(settings, /SETTINGS_CARD_CLASS/);
    assert.match(settings, /SETTINGS_EYEBROW_CLASS/);
    assert.match(settings, /SETTINGS_PRIMARY_BUTTON_CLASS/);
    assert.match(settings, /<BusyLabel\b/);
    // Done = a toast, replaced rather than stacked; the fields wait while saving.
    assert.match(settings, /toast\.success\([^)]*id: "profile-page"/);
    assert.match(settings, /<fieldset[^>]*disabled=\{saving\}/);
    // No private card look.
    assert.doesNotMatch(settings, /shadow-2xl|backdrop-blur/);
  });

  it("sits right below her name and photo, where it shows on the page (user, 2026-10-13)", () => {
    const form = read("components/dashboard/SettingsForm.tsx");
    const namePhoto = form.indexOf("<ProfilePhotoControls");
    const headline = form.indexOf("{profileHeadline}");
    const specialties = form.indexOf("{specialtiesCard}", namePhoto);
    const gesy = form.indexOf("{profileExtra}");
    const ages = form.indexOf("<PatientAgesCard");
    const bio = form.indexOf('htmlFor="settings-bio"');
    const qualifications = form.indexOf("<QualificationsCard");
    assert.ok(namePhoto > 0 && namePhoto < headline && headline < specialties, "headline follows name and photo");
    assert.ok(specialties < gesy && gesy < ages && ages < bio && bio < qualifications, "GeSY stays with who she is");
    assert.doesNotMatch(form, /profilePublicPage/);
    const page = read("app/settings/page.tsx");
    assert.match(page, /profileHeadline=\{/);
  });
});
