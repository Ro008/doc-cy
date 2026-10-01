import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SPECIALTY_LICENSE_HELP,
  pendingSpecialtyChip,
  validateAddSpecialtyRequest,
} from "../../lib/settings-specialty-request";

/**
 * Settings asks for one thing only: add a specialty (user, 2026-10-01). Removing is
 * instant with the chip's ✕, so a change is "add the new one, remove the old one once
 * approved". The form shows every error next to its field at once.
 */

const CATALOGUE = ["Dentist", "Gastroenterology", "Paediatrics"];
const EXISTING = ["Dentist", "Biochemistry"];

describe("validateAddSpecialtyRequest", () => {
  it("returns what the API needs for a catalogue specialty", () => {
    assert.deepEqual(
      validateAddSpecialtyRequest(
        { specialty: "Gastroenterology", fromMaster: true, license: "  CY-123 " },
        CATALOGUE,
        EXISTING,
      ),
      {
        ok: true,
        request: {
          requestKind: "add",
          fromSpecialty: null,
          toSpecialty: "Gastroenterology",
          toSpecialtyFromMaster: true,
          licenseNumber: "CY-123",
        },
      },
    );
  });

  it("names every missing field at once", () => {
    assert.deepEqual(
      validateAddSpecialtyRequest({ specialty: "", fromMaster: true, license: " " }, CATALOGUE, EXISTING),
      {
        ok: false,
        errors: {
          specialty: "Choose the specialty you want to add.",
          license: "Enter your license or certification number.",
        },
      },
    );
  });

  it("asks to describe an Other specialty", () => {
    const result = validateAddSpecialtyRequest(
      { specialty: "", fromMaster: false, license: "CY-1" },
      CATALOGUE,
      EXISTING,
    );
    assert.deepEqual(result, { ok: false, errors: { specialty: "Describe your specialty." } });
  });

  it("refuses a specialty already on the profile, whatever the case", () => {
    const result = validateAddSpecialtyRequest(
      { specialty: "dentist", fromMaster: false, license: "CY-1" },
      CATALOGUE,
      EXISTING,
    );
    assert.deepEqual(result, {
      ok: false,
      errors: { specialty: "You already have this specialty on your profile." },
    });
  });

  it("keeps the catalogue rules for Other", () => {
    const result = validateAddSpecialtyRequest(
      { specialty: "Paediatrics", fromMaster: false, license: "CY-1" },
      CATALOGUE,
      EXISTING,
    );
    assert.equal(result.ok, false);
    assert.match(result.ok === false ? result.errors.specialty ?? "" : "", /select it from the list/);
  });

  it("caps the license length", () => {
    const result = validateAddSpecialtyRequest(
      { specialty: "Gastroenterology", fromMaster: true, license: "x".repeat(81) },
      CATALOGUE,
      EXISTING,
    );
    assert.deepEqual(result, {
      ok: false,
      errors: { license: "Keep the license number under 80 characters." },
    });
  });
});

describe("pendingSpecialtyChip", () => {
  it("shows an added specialty as in review", () => {
    assert.deepEqual(
      pendingSpecialtyChip({ requestKind: "add", fromSpecialty: null, toSpecialty: "Gastroenterology" }),
      { label: "Gastroenterology", status: "In review" },
    );
  });

  it("says which specialty an older change request replaces", () => {
    assert.deepEqual(
      pendingSpecialtyChip({ requestKind: "replace", fromSpecialty: "Dentist", toSpecialty: "Gastroenterology" }),
      { label: "Gastroenterology", status: "In review · replaces Dentist" },
    );
  });

  it("shows an older removal request on the specialty it removes", () => {
    assert.deepEqual(
      pendingSpecialtyChip({ requestKind: "remove", fromSpecialty: "Dentist", toSpecialty: null }),
      { label: "Dentist", status: "Removal in review" },
    );
  });
});

describe("SPECIALTY_LICENSE_HELP", () => {
  it("says why DocCy asks for the license", () => {
    assert.equal(SPECIALTY_LICENSE_HELP, "So DocCy can check you're registered for this specialty.");
  });
});
