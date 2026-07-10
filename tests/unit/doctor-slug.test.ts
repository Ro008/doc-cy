import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDoctorSlugCandidates,
  pickFirstAvailableDoctorSlug,
  slugifyDoctorPublicName,
} from "../../lib/doctor-slug";

describe("doctor-slug", () => {
  it("slugifies doctor names for public URLs", () => {
    assert.equal(slugifyDoctorPublicName("Dr. Anastasia Doc"), "dr-anastasia-doc");
    assert.equal(slugifyDoctorPublicName("  María   López  "), "maria-lopez");
  });

  it("builds district suffix before numeric suffixes", () => {
    const candidates = buildDoctorSlugCandidates({
      name: "Anastasia Smith",
      district: "Paphos",
      authUserId: "11111111-1111-1111-1111-111111111111",
    });

    assert.deepEqual(candidates.slice(0, 3), [
      "anastasia-smith",
      "anastasia-smith-paphos",
      "anastasia-smith-2",
    ]);
  });

  it("picks the first unused candidate", () => {
    const candidates = buildDoctorSlugCandidates({
      name: "Anastasia Smith",
      district: "Paphos",
      authUserId: "11111111-1111-1111-1111-111111111111",
    });

    const taken = new Set(["anastasia-smith", "anastasia-smith-paphos"]);
    assert.equal(
      pickFirstAvailableDoctorSlug(taken, candidates),
      "anastasia-smith-2",
    );
  });

  it("falls back to auth-user suffix when all numbered candidates are taken", () => {
    const candidates = buildDoctorSlugCandidates({
      name: "Anastasia Smith",
      authUserId: "abcdef12-3456-7890-abcd-ef1234567890",
    });
    const taken = new Set(candidates.slice(0, -1).map((slug) => slug.toLowerCase()));

    assert.equal(pickFirstAvailableDoctorSlug(taken, candidates), "anastasia-smith-abcdef12");
  });
});
