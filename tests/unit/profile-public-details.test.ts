import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { patientAgesMessageKey, qualificationDetail } from "../../lib/public/profile-public-details";
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

  it("is its own section with a heading, shown only when she chose", () => {
    const section = read("components/doctor/profile/ProfilePatientsSection.tsx");
    assert.match(section, /patientAgesMessageKey\(patientAges\)/);
    assert.match(section, /if \(!patientsKey\) return null/);
    assert.match(section, /<h2[\s\S]*?t\("patientsSeenHeading"\)/);
    assert.match(section, /data-testid="profile-patients-seen"/);
    // Not a line of About any more.
    const about = read("components/doctor/profile/ProfileAboutSection.tsx");
    assert.doesNotMatch(about, /patientAges|patientsSeen/);
  });
});

describe("qualifications, on the public profile", () => {
  it("says where and when under the title, with whatever she gave", () => {
    assert.equal(qualificationDetail({ institution: "University of Athens", year: 2012 }), "University of Athens · 2012");
    assert.equal(qualificationDetail({ institution: "University of Athens", year: null }), "University of Athens");
    assert.equal(qualificationDetail({ institution: "  ", year: 2012 }), "2012");
    assert.equal(qualificationDetail({ institution: "", year: null }), "");
  });

  it("is its own section, hidden when the list is empty", () => {
    const section = read("components/doctor/profile/ProfileQualificationsSection.tsx");
    assert.match(section, /if \(qualifications\.length === 0\) return null/);
    assert.match(section, /id=\{PROFILE_SECTION_IDS\.qualifications\}/);
    assert.match(section, /qualificationDetail\(/);
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

  it("orders the left column: About, Services, Patients seen, Qualifications, then clinics and reviews", () => {
    const about = page.indexOf("<ProfileAboutSection");
    const services = page.indexOf("<ProfileServicesSection");
    const qualifications = page.indexOf("<ProfileQualificationsSection");
    const clinics = page.indexOf("<ProfileClinicsSection");
    const reviews = page.indexOf("<ProfileReviewsSection");
    const patients = page.indexOf("<ProfilePatientsSection");
    assert.ok(about > 0 && about < services && services < patients && patients < qualifications);
    assert.ok(qualifications < clinics && clinics < reviews);
    assert.match(page.slice(patients, qualifications), /patientAges=\{/);
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
