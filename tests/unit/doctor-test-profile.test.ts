import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isRegisteredDoctorHiddenFromFinder,
  isTestProfileLike,
} from "@/lib/doctor-test-profile";

describe("isTestProfileLike", () => {
  it("flags Finder Filter orphans by name prefix", () => {
    assert.equal(
      isTestProfileLike({
        name: "Finder Filter B 1784303748287-11006",
        slug: "qa-filter-b-1784303748287-11006",
        email: "qa-filter-b-1784303748287-11006@test-doccy.com.cy",
        isTestProfile: false,
      }),
      true,
    );
  });

  it("flags Finder UX doctors by name even with legacy qa-ux slug", () => {
    assert.equal(
      isTestProfileLike({
        name: "Finder UX Limassol Dent 123",
        slug: "qa-ux-limassol-dent-123",
        email: "someone@example.com",
        isTestProfile: false,
      }),
      true,
    );
  });

  it("flags finder-filter slug prefix", () => {
    assert.equal(
      isTestProfileLike({
        name: "Some Real Looking Name",
        slug: "finder-filter-b-999",
        email: "clinic@example.com",
        isTestProfile: false,
      }),
      true,
    );
  });

  it("does not flag ordinary professionals", () => {
    assert.equal(
      isTestProfileLike({
        name: "Maria Papadopoulos",
        slug: "maria-papadopoulos",
        email: "maria@clinic.cy",
        isTestProfile: false,
      }),
      false,
    );
  });
});

describe("isRegisteredDoctorHiddenFromFinder", () => {
  const previous = process.env.NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES;

  it("hides Finder Filter doctors on prod-like config", () => {
    delete process.env.NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES;
    assert.equal(
      isRegisteredDoctorHiddenFromFinder({
        name: "Finder Filter A 1",
        slug: "finder-filter-a-1",
        email: "finder-filter-a-1@test-doccy.com.cy",
        isTestProfile: true,
      }),
      true,
    );
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES;
    } else {
      process.env.NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES = previous;
    }
  });

  it("shows them when INCLUDE_TEST_PROFILES=1", () => {
    process.env.NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES = "1";
    assert.equal(
      isRegisteredDoctorHiddenFromFinder({
        name: "Finder Filter A 1",
        slug: "finder-filter-a-1",
        email: "finder-filter-a-1@test-doccy.com.cy",
        isTestProfile: true,
      }),
      false,
    );
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES;
    } else {
      process.env.NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES = previous;
    }
  });
});
