import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DIRECTORY_CANARIES,
  isDirectoryCanaryClinicId,
  isDirectoryCanaryClinicSlug,
  isDirectoryCanaryId,
  withoutDirectoryCanaryClinics,
  isDirectoryCanaryPhone,
  isDirectoryCanarySlug,
} from "@/lib/directory-canaries";

describe("directory canaries", () => {
  it("registers six honeytoken profiles with unique phones", () => {
    assert.equal(DIRECTORY_CANARIES.length, 6);
    const phones = new Set(DIRECTORY_CANARIES.map((row) => row.phone));
    assert.equal(phones.size, 6);
    for (const row of DIRECTORY_CANARIES) {
      assert.match(row.phone, /^\+3579904180[1-6]$/);
      assert.ok(isDirectoryCanarySlug(row.slug));
      assert.ok(isDirectoryCanaryPhone(row.phone));
      assert.ok(isDirectoryCanaryId(row.id));
    }
  });

  it("rejects non-canary values", () => {
    assert.equal(isDirectoryCanarySlug("andreas-pallouras"), false);
    assert.equal(isDirectoryCanaryPhone("+35799111222"), false);
    assert.equal(isDirectoryCanaryId("00000000-0000-0000-0000-000000000000"), false);
  });

  it("gives every canary its own fake clinic with the reserved phone", () => {
    const clinicIds = new Set(DIRECTORY_CANARIES.map((row) => row.clinicId));
    const clinicSlugs = new Set(DIRECTORY_CANARIES.map((row) => row.clinicSlug));
    assert.equal(clinicIds.size, 6);
    assert.equal(clinicSlugs.size, 6);
    for (const row of DIRECTORY_CANARIES) {
      assert.notEqual(row.clinicId, row.id);
      assert.notEqual(row.clinicSlug, row.slug);
      assert.ok(isDirectoryCanaryClinicId(row.clinicId));
      assert.ok(isDirectoryCanaryClinicSlug(row.clinicSlug));
      assert.equal(isDirectoryCanaryId(row.clinicId), false);
    }
  });

  it("rejects non-canary clinics", () => {
    assert.equal(isDirectoryCanaryClinicId("00000000-0000-0000-0000-000000000000"), false);
    assert.equal(isDirectoryCanaryClinicSlug("golden-recovery"), false);
  });

  it("keeps canary clinics out of clinic lists offered to applicants", () => {
    const real = { id: "11111111-1111-1111-1111-111111111111" };
    const fake = { id: DIRECTORY_CANARIES[0].clinicId };
    assert.deepEqual(withoutDirectoryCanaryClinics([real, fake]), [real]);
  });
});
