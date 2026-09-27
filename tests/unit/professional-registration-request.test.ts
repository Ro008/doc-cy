import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PROFESSIONAL_REGISTRATION_DETAILS_VERSION,
  REGISTRATION_UPLOADS_BUCKET,
  buildProfessionalRegistrationDetails,
  parseProfessionalRegistrationDetails,
  registrationPhotoPath,
  type ProfessionalRegistrationInput,
} from "../../lib/professional-registration-request";

/**
 * The registration form becomes one `professional_registration` request. Its
 * `details` (version 1) describe the professional to create, in business terms:
 * founders read them in the Requests section and approving applies them.
 */

const DOC_CY_CLINIC_ID = "3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b";
const LISTING_ID = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

function input(overrides: Partial<ProfessionalRegistrationInput> = {}): ProfessionalRegistrationInput {
  return {
    firstName: " Karina ",
    lastName: " Miño ",
    gender: "female",
    gesy: "yes",
    email: " karina@example.org ",
    mobile: "+35799123456",
    languages: ["English", "Spanish"],
    photoPath: "professional_registration/u1/photo.jpg",
    specialties: [
      { specialty: "Physiotherapy", fromMaster: true, isApproved: true, licenseNumber: " PT-123 " },
      { specialty: "Dry needling", fromMaster: false, isApproved: false, licenseNumber: "DN-9" },
    ],
    clinics: [
      {
        clinicAddress: "1 Lefkotheou, Paphos 8045, Cyprus",
        district: "Paphos",
        town: "Paphos",
        latitude: 34.77,
        longitude: 32.42,
        clinicPlaceId: "place-1",
        clinicId: DOC_CY_CLINIC_ID,
        name: "",
      },
      {
        clinicAddress: "2 Makariou, Limassol 3030, Cyprus",
        district: "Limassol",
        town: null,
        latitude: 34.68,
        longitude: 33.04,
        clinicPlaceId: null,
        clinicId: "",
        name: " Golden Recovery ",
      },
    ],
    claimedProfessionalId: "",
    disclaimerAccepted: true,
    ...overrides,
  };
}

describe("buildProfessionalRegistrationDetails", () => {
  it("turns the form into version-1 details in business terms", () => {
    const result = buildProfessionalRegistrationDetails(input());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.details, {
      first_name: "Karina",
      last_name: "Miño",
      gender: "female",
      gesy: true,
      email: "karina@example.org",
      mobile: "+35799123456",
      languages: ["English", "Spanish"],
      photo: { bucket: REGISTRATION_UPLOADS_BUCKET, path: "professional_registration/u1/photo.jpg" },
      specialties: [
        { name: "Physiotherapy", from_catalogue: true, license_number: "PT-123" },
        { name: "Dry needling", from_catalogue: false, license_number: "DN-9" },
      ],
      clinics: [
        {
          clinic_id: DOC_CY_CLINIC_ID,
          name: null,
          address: "1 Lefkotheou, Paphos 8045, Cyprus",
          district: "Paphos",
          town: "Paphos",
          latitude: 34.77,
          longitude: 32.42,
          place_id: "place-1",
        },
        {
          clinic_id: null,
          name: "Golden Recovery",
          address: "2 Makariou, Limassol 3030, Cyprus",
          district: "Limassol",
          town: null,
          latitude: 34.68,
          longitude: 33.04,
          place_id: null,
        },
      ],
      claimed_professional_id: null,
      disclaimer_accepted: true,
    });
    assert.equal(PROFESSIONAL_REGISTRATION_DETAILS_VERSION, 1);
  });

  it("stores GeSY as a boolean and accepts either case", () => {
    const no = buildProfessionalRegistrationDetails(input({ gesy: "No", gender: "MALE" }));
    assert.equal(no.ok, true);
    if (!no.ok) return;
    assert.equal(no.details.gesy, false);
    assert.equal(no.details.gender, "male");
  });

  it("keeps the claimed listing only when it is a real id", () => {
    const claimed = buildProfessionalRegistrationDetails(input({ claimedProfessionalId: ` ${LISTING_ID} ` }));
    assert.equal(claimed.ok && claimed.details.claimed_professional_id, LISTING_ID);
    const junk = buildProfessionalRegistrationDetails(input({ claimedProfessionalId: "not-a-uuid" }));
    assert.equal(junk.ok && junk.details.claimed_professional_id, null);
  });

  it("drops a DocCy clinic id that is not a uuid (it becomes a proposed clinic)", () => {
    const clinics = input().clinics.map((c, i) =>
      i === 0 ? { ...c, clinicId: "abc", name: "Named clinic" } : c,
    );
    const result = buildProfessionalRegistrationDetails(input({ clinics }));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.details.clinics[0]!.clinic_id, null);
    assert.equal(result.details.clinics[0]!.name, "Named clinic");
  });

  it("refuses missing gender or GeSY with their own codes", () => {
    assert.deepEqual(buildProfessionalRegistrationDetails(input({ gender: "" })), {
      ok: false,
      code: "gender",
    });
    assert.deepEqual(buildProfessionalRegistrationDetails(input({ gender: "other" })), {
      ok: false,
      code: "gender",
    });
    assert.deepEqual(buildProfessionalRegistrationDetails(input({ gesy: "maybe" })), {
      ok: false,
      code: "gesy",
    });
  });

  it("needs a name for a clinic that is not already in DocCy", () => {
    const clinics = input().clinics.map((c, i) => (i === 1 ? { ...c, name: "  " } : c));
    assert.deepEqual(buildProfessionalRegistrationDetails(input({ clinics })), {
      ok: false,
      code: "clinic_name",
    });
  });

  it("refuses the same DocCy clinic twice", () => {
    const clinics = input().clinics.map((c) => ({ ...c, clinicId: DOC_CY_CLINIC_ID }));
    assert.deepEqual(buildProfessionalRegistrationDetails(input({ clinics })), {
      ok: false,
      code: "clinic_duplicate",
    });
  });

  it("refuses more than five clinics, or none", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      ...input().clinics[1]!,
      clinicAddress: `${i} Makariou`,
    }));
    assert.deepEqual(buildProfessionalRegistrationDetails(input({ clinics: six })), {
      ok: false,
      code: "clinic_address",
    });
    assert.deepEqual(buildProfessionalRegistrationDetails(input({ clinics: [] })), {
      ok: false,
      code: "clinic_address",
    });
  });

  it("refuses missing required fields and an unaccepted disclaimer", () => {
    for (const overrides of [
      { firstName: " " },
      { lastName: "" },
      { email: "" },
      { mobile: "" },
      { languages: [] },
      { photoPath: "" },
      { specialties: [] },
      { disclaimerAccepted: false },
    ] satisfies Partial<ProfessionalRegistrationInput>[]) {
      assert.deepEqual(
        buildProfessionalRegistrationDetails(input(overrides)),
        { ok: false, code: "validation" },
        JSON.stringify(overrides),
      );
    }
  });
});

describe("parseProfessionalRegistrationDetails", () => {
  it("reads back what was built, plus the founders_club flag the database adds", () => {
    const built = buildProfessionalRegistrationDetails(input());
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const stored = JSON.parse(JSON.stringify({ ...built.details, founders_club: true }));
    const parsed = parseProfessionalRegistrationDetails(stored);
    assert.deepEqual(parsed, { ...built.details, founders_club: true });
  });

  it("returns null for anything that is not version-1 registration details", () => {
    assert.equal(parseProfessionalRegistrationDetails(null), null);
    assert.equal(parseProfessionalRegistrationDetails([]), null);
    assert.equal(parseProfessionalRegistrationDetails({ first_name: "A" }), null);
  });
});

describe("registrationPhotoPath", () => {
  it("keeps each applicant's photo under the request type and their login", () => {
    assert.equal(
      registrationPhotoPath("u-123", "abc"),
      "professional_registration/u-123/photo-abc.jpg",
    );
    assert.equal(REGISTRATION_UPLOADS_BUCKET, "request-uploads");
  });
});
