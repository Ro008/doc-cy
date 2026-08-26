import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseSpecialtyChangeRequestKind,
  validateSpecialtyChangeAgainstProfile,
  validateSpecialtyChangeRequestInput,
} from "@/lib/doctor-specialty-change-request";

describe("validateSpecialtyChangeRequestInput", () => {
  it("requires license and a valid specialty", () => {
    assert.equal(
      validateSpecialtyChangeRequestInput({
        toSpecialty: "Pediatrics",
        toSpecialtyFromMaster: true,
        licenseNumber: "",
      }).ok,
      false,
    );
    assert.equal(
      validateSpecialtyChangeRequestInput({
        toSpecialty: "",
        toSpecialtyFromMaster: true,
        licenseNumber: "123",
      }).ok,
      false,
    );
  });

  it("accepts a master specialty with license", () => {
    const result = validateSpecialtyChangeRequestInput({
      toSpecialty: "Pediatrics",
      toSpecialtyFromMaster: true,
      licenseNumber: " 123456 ",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.toSpecialty, "Pediatrics");
      assert.equal(result.licenseNumber, "123456");
      assert.equal(result.isSpecialtyApproved, true);
    }
  });
});

describe("parseSpecialtyChangeRequestKind", () => {
  it("accepts add and replace only", () => {
    assert.equal(parseSpecialtyChangeRequestKind("add"), "add");
    assert.equal(parseSpecialtyChangeRequestKind("REPLACE"), "replace");
    assert.equal(parseSpecialtyChangeRequestKind("change"), null);
    assert.equal(parseSpecialtyChangeRequestKind(""), null);
  });
});

describe("validateSpecialtyChangeAgainstProfile", () => {
  const existing = ["Dentistry", "Psychology"];

  it("allows adding a new specialty", () => {
    const result = validateSpecialtyChangeAgainstProfile({
      kind: "add",
      toSpecialty: "Pediatrics",
      existingLabels: existing,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.fromSpecialty, null);
  });

  it("rejects adding a specialty already on the profile", () => {
    const result = validateSpecialtyChangeAgainstProfile({
      kind: "add",
      toSpecialty: "dentistry",
      existingLabels: existing,
    });
    assert.equal(result.ok, false);
  });

  it("allows replacing one existing specialty with a new one", () => {
    const result = validateSpecialtyChangeAgainstProfile({
      kind: "replace",
      fromSpecialty: "Dentistry",
      toSpecialty: "Pediatrics",
      existingLabels: existing,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.fromSpecialty, "Dentistry");
  });

  it("rejects replace without fromSpecialty or when target already exists", () => {
    assert.equal(
      validateSpecialtyChangeAgainstProfile({
        kind: "replace",
        fromSpecialty: "",
        toSpecialty: "Pediatrics",
        existingLabels: existing,
      }).ok,
      false,
    );
    assert.equal(
      validateSpecialtyChangeAgainstProfile({
        kind: "replace",
        fromSpecialty: "Dentistry",
        toSpecialty: "Psychology",
        existingLabels: existing,
      }).ok,
      false,
    );
    assert.equal(
      validateSpecialtyChangeAgainstProfile({
        kind: "replace",
        fromSpecialty: "Dentistry",
        toSpecialty: "Dentistry",
        existingLabels: existing,
      }).ok,
      false,
    );
  });
});
