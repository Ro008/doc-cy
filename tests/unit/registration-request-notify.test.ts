import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRegistrationRequestNotifyContent,
  registrationNotifyRecipients,
} from "../../lib/registration-request-notify";
import type { ProfessionalRegistrationDetails } from "../../lib/professional-registration-request";

/**
 * When an applicant confirms their email, their registration request is emailed
 * to every active founder. Test registrations go only to FOUNDER_NOTIFY_EMAIL, so
 * integration runs on Testing (whose admin_users holds the real founders) never
 * reach the founders' inboxes.
 */

const founders = [
  { email: "Livio@Example.org", role: "founder", is_active: true },
  { email: "rocio@example.org", role: "founder", is_active: true },
  { email: "gone@example.org", role: "founder", is_active: false },
  { email: "partner@example.org", role: "partner", is_active: true },
];

describe("registrationNotifyRecipients", () => {
  it("emails every active founder for a real applicant", () => {
    assert.deepEqual(
      registrationNotifyRecipients({
        applicantEmail: "karina@example.org",
        founders,
        founderNotifyEmail: "ops@example.org",
      }),
      ["livio@example.org", "rocio@example.org"],
    );
  });

  it("drops duplicates", () => {
    assert.deepEqual(
      registrationNotifyRecipients({
        applicantEmail: "karina@example.org",
        founders: [...founders, { email: "LIVIO@example.org", role: "founder", is_active: true }],
        founderNotifyEmail: "",
      }),
      ["livio@example.org", "rocio@example.org"],
    );
  });

  it("falls back to FOUNDER_NOTIFY_EMAIL when no founder can be read", () => {
    assert.deepEqual(
      registrationNotifyRecipients({
        applicantEmail: "karina@example.org",
        founders: [],
        founderNotifyEmail: "a@example.org, b@example.org",
      }),
      ["a@example.org", "b@example.org"],
    );
  });

  it("sends test registrations only to FOUNDER_NOTIFY_EMAIL, or to nobody", () => {
    for (const applicantEmail of [
      "someone@integration.test",
      "rociosirvent+rege2e1@gmail.com",
      "test-registration-e2e-avatar-1234567890@test-doccy.com.cy",
    ]) {
      assert.deepEqual(
        registrationNotifyRecipients({ applicantEmail, founders, founderNotifyEmail: "qa@example.org" }),
        ["qa@example.org"],
        applicantEmail,
      );
      assert.deepEqual(
        registrationNotifyRecipients({ applicantEmail, founders, founderNotifyEmail: "" }),
        [],
        applicantEmail,
      );
    }
  });
});

const details: ProfessionalRegistrationDetails = {
  first_name: "Karina",
  last_name: "Miño",
  gender: "female",
  gesy: true,
  email: "karina@example.org",
  mobile: "+35799123456",
  languages: ["English", "Spanish"],
  photo: { bucket: "request-uploads", path: "professional_registration/u1/photo-a.jpg" },
  specialties: [
    { name: "Physiotherapy", from_catalogue: true, license_number: "PT-123" },
    { name: "Dry needling", from_catalogue: false, license_number: "DN-9" },
  ],
  clinics: [
    {
      clinic_id: "3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b",
      name: null,
      address: "1 Lefkotheou, Paphos",
      district: "Paphos",
      town: "Paphos",
      latitude: 34.77,
      longitude: 32.42,
      place_id: null,
    },
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

describe("buildRegistrationRequestNotifyContent", () => {
  it("tags a new profile and lists what the founders review", () => {
    const { subject, text } = buildRegistrationRequestNotifyContent({
      requestId: "req-1",
      details,
      siteUrl: "https://www.mydoccy.com/",
      clinicNames: { "3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b": "Lefkotheou Clinic" },
    });
    assert.equal(subject, "[UNCLAIMED PROFILE] Registration request: Karina Miño");
    for (const line of [
      "Name: Karina Miño",
      "Email: karina@example.org",
      "Mobile: +35799123456",
      "Gender: female",
      "GeSY: yes",
      "Languages: English, Spanish",
      "- Physiotherapy (licence PT-123)",
      "- Dry needling (licence DN-9) — not in the catalogue",
      "- Lefkotheou Clinic (DocCy clinic): 1 Lefkotheou, Paphos · Paphos",
      "- Golden Recovery (new clinic): 2 Makariou, Limassol · Limassol",
      "Founders' Club place: reserved",
      "Request id: req-1",
      "Review: https://www.mydoccy.com/internal/directory?tab=requests",
    ]) {
      assert.ok(text.includes(line), `missing line: ${line}\n---\n${text}`);
    }
  });

  it("tags a claimed profile with the listing's public URL", () => {
    const { subject, text } = buildRegistrationRequestNotifyContent({
      requestId: "req-2",
      details: { ...details, claimed_professional_id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d", founders_club: false },
      siteUrl: "https://www.mydoccy.com",
      claimedListingUrl: "https://www.mydoccy.com/en/karina-mino",
    });
    assert.equal(subject, "[CLAIMED PROFILE] Registration request: Karina Miño");
    assert.ok(text.includes("Claimed listing: https://www.mydoccy.com/en/karina-mino"));
    assert.ok(text.includes("Founders' Club place: no (standard pricing)"));
  });
});
