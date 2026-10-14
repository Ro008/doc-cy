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
    assert.equal(patientAgesMessageKey("adults"), "patientsAdults");
    assert.equal(patientAgesMessageKey("children"), "patientsChildren");
    assert.equal(patientAgesMessageKey("all"), "patientsAll");
    assert.equal(patientAgesMessageKey(null), null);
  });

  it("is one line of About, under the bio, shown only when she chose (user, 2026-10-14)", () => {
    const about = read("components/doctor/profile/ProfileAboutSection.tsx");
    assert.match(about, /patientAgesMessageKey\(patientAges\)/);
    assert.match(about, /patientsKey \? \(/);
    assert.match(about, /data-testid="profile-patients-seen"/);
    assert.match(about, /t\("patientsSeenHeading"\)/);
    // A label, not a heading: no section of its own any more.
    assert.doesNotMatch(about, /<h3/);
    assert.ok(about.indexOf("{bioText ||") < about.indexOf('data-testid="profile-patients-seen"'));
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
    // One card with rows, like Services & prices; no icon on every row.
    assert.match(section, /divide-y divide-profile-border/);
    assert.doesNotMatch(section, /GraduationCap|sm:grid-cols-2/);
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
    assert.match(page.slice(about, services), /patientAges=\{profileDetails\.patientAges\}/);
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
        "patientsSeenHeading",
        "patientsAdults",
        "patientsChildren",
        "patientsAll",
      ]) {
        assert.equal(typeof messages[key], "string", `${file} ${key}`);
      }
    }
  });
});
