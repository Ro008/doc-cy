import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRegistrationApprovedEmail,
  buildRegistrationDeniedEmail,
  describeRegistrationCorrections,
  isUndeliverableTestEmail,
} from "../../lib/registration-decision-emails";
import type { ProfessionalRegistrationDetails } from "../../lib/professional-registration-request";

/**
 * The applicant is emailed every decision: approved (what was applied, including
 * the founders' corrections) or not approved (with the reason, and how to apply
 * again).
 */

const original: ProfessionalRegistrationDetails = {
  first_name: "Karina",
  last_name: "Mino",
  gender: "female",
  gesy: true,
  email: "karina@example.org",
  mobile: "+35799123456",
  languages: ["English"],
  photo: { bucket: "request-uploads", path: "professional_registration/u1/photo-a.jpg" },
  specialties: [{ name: "Physiotherapy", from_catalogue: true, license_number: "PT-1" }],
  clinics: [
    {
      clinic_id: null,
      name: "Golden Recovery",
      address: "2 Makariou, Limassol",
      district: "Limassol",
      town: null,
      latitude: 34.68,
      longitude: 33.04,
      place_id: null,
    },
  ],
  claimed_professional_id: null,
  disclaimer_accepted: true,
  founders_club: true,
};

describe("describeRegistrationCorrections", () => {
  it("lists nothing when the founders changed nothing", () => {
    assert.deepEqual(describeRegistrationCorrections(original, null), []);
    assert.deepEqual(describeRegistrationCorrections(original, { ...original }), []);
  });

  it("names each corrected part in plain words", () => {
    const approved: ProfessionalRegistrationDetails = {
      ...original,
      last_name: "Miño",
      gesy: false,
      languages: ["English", "Spanish"],
      photo: null,
      specialties: [{ name: "Physiotherapy", from_catalogue: true, license_number: "PT-2" }],
      clinics: [{ ...original.clinics[0]!, name: "Golden Recovery Clinic" }],
      claimed_professional_id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d",
    };
    assert.deepEqual(describeRegistrationCorrections(original, approved), [
      "Name: Karina Miño",
      "GeSY: no",
      "Languages: English, Spanish",
      "Specialties: Physiotherapy (licence PT-2)",
      "Clinics: Golden Recovery Clinic (2 Makariou, Limassol)",
      "Photo: removed (you can add one from Settings)",
      "Your existing DocCy listing was connected to your account",
    ]);
  });

  it("says when the photo was replaced", () => {
    const approved = { ...original, photo: { bucket: "request-uploads" as const, path: "professional_registration/u1/founder-1.jpg" } };
    assert.deepEqual(describeRegistrationCorrections(original, approved), ["Photo: replaced by our team"]);
  });
});

describe("buildRegistrationApprovedEmail", () => {
  it("links the sign-in and the public profile, with the trial end date and corrections", () => {
    const email = buildRegistrationApprovedEmail({
      name: "Karina Miño",
      siteUrl: "https://www.mydoccy.com",
      profilePath: "/en/karina-mino",
      accessUntil: "2027-03-27T22:00:00Z",
      corrections: ["GeSY: no"],
    });
    assert.equal(email.subject, "[DocCy] You're approved: your profile is live");
    assert.match(email.text, /Hi Karina,/);
    assert.match(email.text, /https:\/\/www\.mydoccy\.com\/login\?next=%2Fagenda%2Fsettings/);
    assert.match(email.text, /https:\/\/www\.mydoccy\.com\/en\/karina-mino/);
    assert.match(email.text, /free until 28 March 2027/);
    assert.match(email.text, /While reviewing your application we changed:\n- GeSY: no/);
    assert.match(email.html, /Sign in to DocCy/);
  });

  it("leaves out the trial and corrections when there are none", () => {
    const email = buildRegistrationApprovedEmail({
      name: "Karina Miño",
      siteUrl: "https://www.mydoccy.com",
      profilePath: "/en/karina-mino",
      accessUntil: null,
      corrections: [],
    });
    assert.doesNotMatch(email.text, /free until/);
    assert.doesNotMatch(email.text, /we changed/);
  });

  it("escapes names in the HTML", () => {
    const email = buildRegistrationApprovedEmail({
      name: "<b>Eve</b> X",
      siteUrl: "https://www.mydoccy.com",
      profilePath: "/en/eve",
      accessUntil: null,
      corrections: [],
    });
    assert.doesNotMatch(email.html, /<b>Eve/);
  });
});

describe("buildRegistrationDeniedEmail", () => {
  it("gives the reason and how to apply again", () => {
    const email = buildRegistrationDeniedEmail({
      name: "Karina Miño",
      siteUrl: "https://www.mydoccy.com",
      reason: "Licence number not found",
    });
    assert.equal(email.subject, "[DocCy] Your application was not approved");
    assert.match(email.text, /Licence number not found/);
    assert.match(email.text, /https:\/\/www\.mydoccy\.com\/login\?next=%2Fagenda%2Fstatus/);
    assert.match(email.html, /Apply again/);
  });
});

describe("isUndeliverableTestEmail", () => {
  it("skips addresses nobody can receive, but not real test inboxes", () => {
    assert.equal(isUndeliverableTestEmail("a@integration.test"), true);
    assert.equal(isUndeliverableTestEmail("test-registration-e2e-avatar-1@test-doccy.com.cy"), true);
    assert.equal(isUndeliverableTestEmail("rociosirvent+e2e@gmail.com"), false);
    assert.equal(isUndeliverableTestEmail("karina@example.org"), false);
  });
});
