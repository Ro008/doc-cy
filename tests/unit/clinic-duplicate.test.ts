import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clinicNameKey, findClinicLookalike } from "../../lib/clinic-duplicate";

/**
 * "Is this your clinic? Join it instead" (user, 2026-10-11): a clinic asked for as new
 * that DocCy very likely already has.
 */

const docCy = [
  { id: "a", name: "Makariou Medical Centre", address: "1 Makariou, Limassol", latitude: 34.68, longitude: 33.04, placeId: "place-a" },
  { id: "b", name: "Dr. Vera Politou", address: "2 Ledra, Nicosia", latitude: 35.17, longitude: 33.36, placeId: null },
];
const typed = (patch: Partial<Parameters<typeof findClinicLookalike>[0]>) => ({
  name: "",
  latitude: null,
  longitude: null,
  placeId: null,
  ...patch,
});

describe("clinicNameKey", () => {
  it("ignores capitals, accents, punctuation and words every clinic has", () => {
    assert.equal(clinicNameKey("  Makaríou   Medical-Centre "), "makariou");
    assert.equal(clinicNameKey("Dr. Vera Politou"), clinicNameKey("vera politou clinic"));
    assert.equal(clinicNameKey("Κλινική Αγίου"), "κλινικη αγιου");
  });
});

describe("findClinicLookalike", () => {
  it("finds the same Google place, whatever she typed as its name", () => {
    assert.equal(findClinicLookalike(typed({ name: "My rooms", placeId: "place-a" }), docCy)?.id, "a");
  });

  it("finds the same name close by", () => {
    assert.equal(
      findClinicLookalike(typed({ name: "makariou medical center", latitude: 34.6805, longitude: 33.0405 }), docCy)?.id,
      "a",
    );
    // Same name with no pin to compare.
    assert.equal(findClinicLookalike(typed({ name: "Vera Politou" }), docCy)?.id, "b");
  });

  it("does not match the same name in another town, or another name next door", () => {
    assert.equal(
      findClinicLookalike(typed({ name: "Makariou Medical Centre", latitude: 34.77, longitude: 32.42 }), docCy),
      null,
    );
    assert.equal(
      findClinicLookalike(typed({ name: "Skin Clinic", latitude: 34.68, longitude: 33.04 }), docCy),
      null,
    );
    assert.equal(findClinicLookalike(typed({ name: "" }), docCy), null);
  });

  it("never offers a clinic she already works at", () => {
    assert.equal(findClinicLookalike(typed({ name: "My rooms", placeId: "place-a" }), docCy, ["a"]), null);
  });
});
