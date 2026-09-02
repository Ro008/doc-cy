import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isProfessionalUuid,
  pickExplicitDirectoryClaim,
  pickUniqueDirectoryClaim,
  pickUniqueHistoricalAbsorbPairs,
  registerClaimPath,
  toRegisterClaimPrefill,
} from "@/lib/claim-directory-professional";

const maria = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "maria-pap-nicosia",
  name: "Maria Papadopoulou",
  specialty: "Dentist",
  specialties: ["Dentist"],
  district: "Nicosia",
  email: "maria@example.com",
};

describe("pickUniqueDirectoryClaim", () => {
  it("claims a unique email match", () => {
    const match = pickUniqueDirectoryClaim(
      {
        name: "Maria Papadopoulou",
        email: "Maria@example.com",
        district: "Nicosia",
        specialties: ["Dentistry"],
      },
      [maria],
    );
    assert.deepEqual(match, {
      id: maria.id,
      slug: maria.slug,
      reason: "email",
    });
  });

  it("claims a unique name + specialty + district match when email is absent on the listing", () => {
    const match = pickUniqueDirectoryClaim(
      {
        name: "Dr. Maria Papadopoulou",
        email: "new@clinic.com",
        district: "Nicosia",
        specialties: ["Dentist"],
      },
      [{ ...maria, email: null }],
    );
    assert.equal(match?.id, maria.id);
    assert.equal(match?.reason, "name_specialty_district");
  });

  it("does not claim when two listings share the same identity", () => {
    const match = pickUniqueDirectoryClaim(
      {
        name: "Maria Papadopoulou",
        email: "other@example.com",
        district: "Nicosia",
        specialties: ["Dentist"],
      },
      [
        { ...maria, email: null },
        {
          ...maria,
          id: "22222222-2222-2222-2222-222222222222",
          slug: "maria-pap-nicosia-2",
          email: null,
        },
      ],
    );
    assert.equal(match, null);
  });

  it("does not claim test signups", () => {
    const match = pickUniqueDirectoryClaim(
      {
        name: "Maria Papadopoulou",
        email: "rociosirvent+maria@gmail.com",
        district: "Nicosia",
        specialties: ["Dentist"],
        isTestSignup: true,
      },
      [maria],
    );
    assert.equal(match, null);
  });

  it("does not claim when email and name point at different people", () => {
    const match = pickUniqueDirectoryClaim(
      {
        name: "Andreas Nikos",
        email: "maria@example.com",
        district: "Paphos",
        specialties: ["Neurology"],
      },
      [
        maria,
        {
          id: "33333333-3333-3333-3333-333333333333",
          slug: "andreas-nikos",
          name: "Andreas Nikos",
          specialty: "Neurology",
          specialties: ["Neurology"],
          district: "Paphos",
          email: null,
        },
      ],
    );
    assert.equal(match, null);
  });
});

describe("pickUniqueHistoricalAbsorbPairs", () => {
  it("absorbs a unique email twin", () => {
    const pairs = pickUniqueHistoricalAbsorbPairs(
      [
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          name: "Maria Papadopoulou",
          email: "maria@example.com",
          district: "Nicosia",
          specialties: ["Dentistry"],
        },
      ],
      [maria],
    );
    assert.deepEqual(pairs, [
      {
        registeredId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        unregisteredId: maria.id,
        reason: "email",
      },
    ]);
  });

  it("skips test registered profiles", () => {
    const pairs = pickUniqueHistoricalAbsorbPairs(
      [
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          name: "Maria Papadopoulou",
          email: "maria@example.com",
          district: "Nicosia",
          specialties: ["Dentistry"],
          isTestProfile: true,
        },
      ],
      [maria],
    );
    assert.deepEqual(pairs, []);
  });

  it("drops pairs when two registered accounts match the same listing", () => {
    const pairs = pickUniqueHistoricalAbsorbPairs(
      [
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          name: "Maria Papadopoulou",
          email: "maria@example.com",
          district: "Nicosia",
          specialties: ["Dentist"],
        },
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          name: "Maria Papadopoulou",
          email: "other@example.com",
          district: "Nicosia",
          specialties: ["Dentist"],
        },
      ],
      [{ ...maria, email: null }],
    );
    assert.deepEqual(pairs, []);
  });
});

describe("register claim from finder card", () => {
  it("builds a register URL with the listing id only", () => {
    assert.equal(isProfessionalUuid(maria.id), true);
    assert.equal(isProfessionalUuid("not-an-id"), false);
    assert.equal(registerClaimPath(maria.id), `/register?claim=${maria.id}`);
  });

  it("prefills name, first name, phone, and GeSY specialty as a master choice", () => {
    const prefill = toRegisterClaimPrefill({
      ...maria,
      phone: "+35799111222",
      address: "12 Ledras Street, Nicosia",
    });
    assert.equal(prefill.firstName, "Maria");
    assert.equal(prefill.phone, "+35799111222");
    assert.equal(prefill.addressHint, "12 Ledras Street, Nicosia");
    assert.equal(prefill.specialties[0]?.specialty, "Dentist");
    assert.equal(prefill.specialties[0]?.fromMaster, true);
  });

  it("binds the explicit card listing even when the typed name would not fuzzy-match", () => {
    const match = pickExplicitDirectoryClaim({ id: maria.id, slug: maria.slug });
    assert.deepEqual(match, {
      id: maria.id,
      slug: maria.slug,
      reason: "card_link",
    });
  });

  it("never binds a card listing to a test signup", () => {
    assert.equal(
      pickExplicitDirectoryClaim({ id: maria.id, slug: maria.slug }, { isTestSignup: true }),
      null,
    );
  });
});
