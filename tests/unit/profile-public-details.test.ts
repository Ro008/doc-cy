import assert from "node:assert/strict";
import fs, { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  patientAgesMessageKey,
  qualificationsNewestFirst,
} from "../../lib/public/profile-public-details";
import { PROFILE_SECTION_IDS, profileSectionTabs } from "../../lib/public/profile-sections";

/**
 * Public profile, left column (user, 2026-10-13): About, Services & prices, Patients seen,
 * Qualifications, then the rest, each a section with its heading on the left. "Patients I see" and the qualifications are what
 * she saved in Settings › Profile; neither shows when she has not filled it in.
 */

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("patients she sees, on the public profile", () => {
  it("has a message for each of the three choices and none when not chosen", () => {
    assert.equal(patientAgesMessageKey("adults"), "heroSeesAdults");
    assert.equal(patientAgesMessageKey("children"), "heroSeesChildren");
    assert.equal(patientAgesMessageKey("all"), "heroSeesAll");
    assert.equal(patientAgesMessageKey(null), null);
  });

  it("is a fact of the hero, 'Sees adults and children', not a line of About (user, 2026-10-14)", () => {
    const about = read("components/doctor/profile/ProfileAboutSection.tsx");
    assert.doesNotMatch(about, /patientAges|profile-patients-seen/);
    const page = read("lib/public/doctor-profile-page.tsx");
    const facts = page.indexOf('data-testid="profile-hero-facts"');
    const languages = page.indexOf('t("heroSpeaks"');
    const patients = page.indexOf('data-testid="profile-patients-seen"');
    const mobile = page.indexOf("<RevealMobileButton");
    assert.ok(facts > 0 && facts < languages && languages < patients && patients < mobile);
    assert.match(page, /patientAgesMessageKey\(profileDetails\.patientAges\)/);
    assert.match(page, /patientsKey \? \(/);
    assert.equal(
      fs.existsSync(join(process.cwd(), "components/doctor/profile/ProfilePatientsSection.tsx")),
      false,
    );
  });
});

describe("qualifications, on the public profile", () => {
  it("lists the newest first; lines without a year keep her order, at the end (user, 2026-10-14)", () => {
    const q = (id: string, year: number | null) => ({ id, title: id, institution: "", year });
    assert.deepEqual(
      qualificationsNewestFirst([q("a", 2008), q("b", null), q("c", 2015), q("d", 2008), q("e", null)]).map(
        (row) => row.id,
      ),
      ["c", "a", "d", "b", "e"],
    );
    const list = [q("x", 2001)];
    qualificationsNewestFirst(list);
    assert.equal(list.length, 1);
  });

  it("is its own section, like a CV: year on the left, title, institution below; hidden when empty", () => {
    const section = read("components/doctor/profile/ProfileQualificationsSection.tsx");
    assert.match(section, /if \(qualifications\.length === 0\) return null/);
    assert.match(section, /id=\{PROFILE_SECTION_IDS\.qualifications\}/);
    assert.match(section, /qualificationsNewestFirst\(qualifications\)/);
    assert.match(section, /data-testid="profile-qualification-year"/);
    // One card with rows, like Services & prices; a small mortarboard on each row, hidden
    // from screen readers (preview for the user, 2026-10-14).
    assert.match(section, /divide-y divide-profile-border/);
    assert.match(section, /<GraduationCap\b[^>]*aria-hidden/);
    assert.doesNotMatch(section, /sm:grid-cols-2/);
    assert.doesNotMatch(section, /dangerouslySetInnerHTML/);
  });

  it("gets a tab after Services, only when she has some", () => {
    assert.equal(PROFILE_SECTION_IDS.qualifications, "qualifications");
    assert.deepEqual(
      profileSectionTabs({ hasServices: true, hasQualifications: true, hasClinics: true, hasReviews: true }).map(
        (tab) => tab.id,
      ),
      ["book", "about", "services", "qualifications", "clinics", "reviews"],
    );
    assert.deepEqual(
      profileSectionTabs({ hasServices: true, hasClinics: true }).map((tab) => tab.id),
      ["book", "about", "services", "clinics"],
    );
  });
});

describe("the page reads and places them", () => {
  const page = read("lib/public/doctor-profile-page.tsx");

  it("reads what she saved in Settings, through the same loader", () => {
    assert.match(page, /loadProfileDetails\(supabase, profile\.id\)/);
    assert.match(page, /hasQualifications:/);
  });

  it("orders the left column: About (with the patients she sees), Services, Qualifications, then reviews", () => {
    const about = page.indexOf("<ProfileAboutSection");
    const services = page.indexOf("<ProfileServicesSection");
    const qualifications = page.indexOf("<ProfileQualificationsSection");
    const reviews = page.indexOf("<ProfileReviewsSection");
    assert.ok(about > 0 && about < services && services < qualifications && qualifications < reviews);
    assert.doesNotMatch(page, /<ProfilePatientsSection\b/);
    // Her clinics are in the booking column, next to these sections.
    assert.doesNotMatch(page, /<ProfileClinicsSection\b/);
  });

  it("has the copy in English and Greek", () => {
    for (const file of ["messages/en.json", "messages/el.json"]) {
      const messages = JSON.parse(read(file)).DoctorProfilePage;
      for (const key of [
        "sectionTabQualifications",
        "qualificationsHeading",
        "heroSeesAdults",
        "heroSeesChildren",
        "heroSeesAll",
      ]) {
        assert.equal(typeof messages[key], "string", `${file} ${key}`);
      }
    }
  });
});
