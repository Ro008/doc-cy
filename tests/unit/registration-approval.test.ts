import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  approvalErrorMessage,
  approvedAvatarPath,
  claimedListingKeepsSlug,
  listingUrlExample,
  parseListingUrl,
  validateApprovedRegistrationDetails,
} from "../../lib/registration-approval";
import type { ProfessionalRegistrationDetails } from "../../lib/professional-registration-request";

/**
 * Founders review a professional_registration request in the Requests section:
 * every field is editable (stored as approved_details) except the email, the
 * photo can be removed, and an unclaimed request can be matched to a listing by
 * pasting its public URL.
 */

const CLINIC_ID = "3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b";
const LISTING_ID = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

const original: ProfessionalRegistrationDetails = {
  first_name: "Karina",
  last_name: "Miño",
  gender: "female",
  gesy: true,
  email: "karina@example.org",
  mobile: "+35799123456",
  languages: ["English"],
  photo: { bucket: "request-uploads", path: "professional_registration/u1/photo-a.jpg" },
  specialties: [{ name: "Physiotherapy", from_catalogue: true, license_number: "PT-1" }],
  clinics: [
    {
      clinic_id: CLINIC_ID,
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

function edited(overrides: Partial<ProfessionalRegistrationDetails>): unknown {
  return JSON.parse(JSON.stringify({ ...original, ...overrides }));
}

describe("validateApprovedRegistrationDetails", () => {
  it("accepts the request unchanged", () => {
    const result = validateApprovedRegistrationDetails(original, edited({}));
    assert.deepEqual(result, { ok: true, details: original });
  });

  it("accepts founders' corrections and trims them", () => {
    const result = validateApprovedRegistrationDetails(
      original,
      edited({
        last_name: "  Mino ",
        languages: ["English", " Spanish "],
        specialties: [{ name: " Physiotherapy ", from_catalogue: true, license_number: " PT-2 " }],
        claimed_professional_id: LISTING_ID,
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.details.last_name, "Mino");
    assert.deepEqual(result.details.languages, ["English", "Spanish"]);
    assert.equal(result.details.specialties[0]!.license_number, "PT-2");
    assert.equal(result.details.claimed_professional_id, LISTING_ID);
  });

  it("maps a proposed clinic to an existing one", () => {
    const clinics = original.clinics.map((c, i) =>
      i === 1 ? { ...c, clinic_id: "0b9a8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d", name: null } : c,
    );
    const result = validateApprovedRegistrationDetails(original, edited({ clinics }));
    assert.equal(result.ok, true);
  });

  it("allows removing the photo", () => {
    const result = validateApprovedRegistrationDetails(original, edited({ photo: null as never }));
    assert.equal(result.ok && result.details.photo, null);
  });

  it("never changes the email (it is the login) or the Founders' Club place", () => {
    assert.deepEqual(
      validateApprovedRegistrationDetails(original, edited({ email: "other@example.org" })),
      { ok: false, message: "The email is the applicant's login and can't be changed." },
    );
    const result = validateApprovedRegistrationDetails(original, edited({ founders_club: false }));
    assert.equal(result.ok && result.details.founders_club, true);
  });

  it("refuses incomplete or inconsistent details", () => {
    const cases: Array<[Partial<ProfessionalRegistrationDetails>, RegExp]> = [
      [{ first_name: " " }, /first and last name/],
      [{ gender: "other" as never }, /gender/],
      [{ languages: [] }, /language/],
      [{ mobile: "" }, /mobile/],
      [{ specialties: [] }, /specialty/],
      [
        {
          specialties: [
            { name: "Physiotherapy", from_catalogue: true, license_number: "1" },
            { name: "physiotherapy", from_catalogue: true, license_number: "2" },
          ],
        },
        /twice/,
      ],
      [{ clinics: [] }, /clinic/],
      [{ clinics: [original.clinics[0]!, original.clinics[0]!] }, /same clinic twice/],
      [{ clinics: [{ ...original.clinics[1]!, name: "" }] }, /name/],
      [{ clinics: [{ ...original.clinics[1]!, district: "Atlantis" }] }, /district/],
      [{ clinics: [{ ...original.clinics[1]!, address: " " }] }, /address/],
      [{ claimed_professional_id: "nope" }, /listing/],
    ];
    for (const [overrides, message] of cases) {
      const result = validateApprovedRegistrationDetails(original, edited(overrides));
      assert.equal(result.ok, false, JSON.stringify(overrides));
      if (!result.ok) assert.match(result.message, message, JSON.stringify(overrides));
    }
  });
});

describe("parseListingUrl", () => {
  const site = "https://www.mydoccy.com";
  const slug = (value: string, siteUrl = site) => {
    const result = parseListingUrl(value, siteUrl);
    return result.ok ? result.slug : null;
  };

  it("reads the slug from a public profile URL or path", () => {
    assert.equal(slug("https://www.mydoccy.com/en/karina-mino"), "karina-mino");
    assert.equal(slug(" https://www.mydoccy.com/el/karina-mino/?utm=x#top "), "karina-mino");
    assert.equal(slug("/en/karina-mino"), "karina-mino");
    assert.equal(slug("https://www.mydoccy.com/finder/professional/karina-mino"), "karina-mino");
    // With or without "www." and the scheme.
    assert.equal(slug("https://mydoccy.com/en/karina-mino"), "karina-mino");
    assert.equal(slug("www.mydoccy.com/en/karina-mino"), "karina-mino");
    assert.equal(slug("mydoccy.com/en/Karina-Mino"), "karina-mino");
  });

  it("accepts the current site's own address, e.g. localhost when testing", () => {
    const local = "http://localhost:3000";
    assert.equal(slug("http://localhost:3000/en/Karina-Mino", local), "karina-mino");
    assert.equal(slug("localhost:3000/en/karina-mino", local), "karina-mino");
    // Another local port is the same site (specs run the app on :3100).
    assert.equal(slug("http://localhost:3100/en/karina-mino", local), "karina-mino");
  });

  it("refuses a profile URL from another site", () => {
    const result = parseListingUrl("https://www.mydoccy.com/en/karina-mino", "http://localhost:3000");
    assert.deepEqual(result, { ok: false, reason: "other_site" });
    assert.deepEqual(parseListingUrl("https://example.com/en/karina-mino", site), { ok: false, reason: "other_site" });
  });

  it("refuses anything that isn't a profile URL", () => {
    for (const value of [
      "",
      "karina",
      "https://www.mydoccy.com/en",
      "https://www.mydoccy.com/paphos/cardiology",
      "https://www.mydoccy.com/en/karina-mino/book",
      "ftp://www.mydoccy.com/en/karina-mino",
    ]) {
      assert.deepEqual(parseListingUrl(value, site), { ok: false, reason: "not_profile" }, value);
    }
  });
});

describe("listingUrlExample", () => {
  it("shows the current site's address", () => {
    assert.equal(listingUrlExample("http://localhost:3000"), "http://localhost:3000/en/name");
    assert.equal(listingUrlExample("https://www.mydoccy.com/"), "https://www.mydoccy.com/en/name");
  });
});

describe("claimedListingKeepsSlug", () => {
  it("keeps the listing's slug when it still matches the approved name", () => {
    assert.equal(claimedListingKeepsSlug("karina-mino", { name: "Karina Miño", district: "Paphos" }), true);
    assert.equal(claimedListingKeepsSlug("karina-mino-paphos", { name: "Karina Miño", district: "Paphos" }), true);
    assert.equal(claimedListingKeepsSlug("karina-mino-2", { name: "Karina Mino", district: null }), true);
  });

  it("needs a new slug when the name changed", () => {
    assert.equal(claimedListingKeepsSlug("maria-georgiou", { name: "Karina Miño", district: "Paphos" }), false);
    assert.equal(claimedListingKeepsSlug(null, { name: "Karina Miño", district: "Paphos" }), false);
  });
});

describe("approvedAvatarPath", () => {
  it("puts the approved photo in the public avatars layout", () => {
    assert.equal(approvedAvatarPath("u-1", "abc"), "profiles/u-1/avatar-abc.jpg");
  });
});

describe("approvalErrorMessage", () => {
  it("explains the database's refusals", () => {
    assert.match(
      approvalErrorMessage({ code: "55000", message: "the claimed listing is already registered" }),
      /already registered/,
    );
    assert.match(approvalErrorMessage({ code: "P0002", message: "clinic 123 not found" }), /clinic 123 not found/i);
    assert.match(approvalErrorMessage({ code: "42501", message: "x" }), /founders/);
    assert.match(approvalErrorMessage({ code: "XX000", message: "boom" }), /Could not approve/);
  });
});
