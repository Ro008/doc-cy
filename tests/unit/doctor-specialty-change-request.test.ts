import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateSpecialtyChangeRequestInput } from "@/lib/doctor-specialty-change-request";

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
