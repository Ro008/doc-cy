import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatSpecialtiesForSeo,
  publicSpecialtyLabels,
  validateDoctorSpecialtyEntries,
} from "@/lib/doctor-specialties";

describe("validateDoctorSpecialtyEntries", () => {
  it("requires at least one specialty with license", () => {
    assert.equal(validateDoctorSpecialtyEntries([]).ok, false);
    assert.equal(
      validateDoctorSpecialtyEntries([
        { specialty: "Pediatrics", fromMaster: true, licenseNumber: "" },
      ]).ok,
      false,
    );
  });

  it("accepts multiple distinct specialties", () => {
    const result = validateDoctorSpecialtyEntries([
      { specialty: "Psychology", fromMaster: true, licenseNumber: "A1" },
      { specialty: "Psychiatry", fromMaster: true, licenseNumber: "B2" },
    ]);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.entries.length, 2);
      assert.equal(result.entries[0]?.specialty, "Psychology");
      assert.equal(result.entries[1]?.specialty, "Psychiatry");
    }
  });

  it("rejects duplicates", () => {
    const result = validateDoctorSpecialtyEntries([
      { specialty: "Dentistry", fromMaster: true, licenseNumber: "1" },
      { specialty: "Dentistry", fromMaster: true, licenseNumber: "2" },
    ]);
    assert.equal(result.ok, false);
    if (result.ok === false) {
      assert.match(result.message, /duplicate specialty/i);
    }
  });
});

describe("publicSpecialtyLabels", () => {
  it("prefers specialties array and hides unapproved", () => {
    assert.deepEqual(
      publicSpecialtyLabels({
        specialties: ["Psychology", "Psychiatry"],
        specialty: "Psychology",
        is_specialty_approved: true,
      }),
      ["Psychology", "Psychiatry"],
    );
    assert.deepEqual(
      publicSpecialtyLabels({
        specialties: ["Psychology"],
        specialty: "Psychology",
        is_specialty_approved: false,
      }),
      [],
    );
    assert.equal(
      formatSpecialtiesForSeo(["Psychology", "Psychiatry"]),
      "Psychology · Psychiatry",
    );
  });
});
