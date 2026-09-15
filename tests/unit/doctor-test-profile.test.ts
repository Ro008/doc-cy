import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isDocCyTestingSupabaseProject,
  isQaClaimDirectoryListing,
  isRegisteredDoctorHiddenFromFinder,
  isTestDoctorRegistrationEmail,
  isTestProfileLike,
  restrictTestSignupDirectoryClaimsToQaListings,
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

  it("flags QA claim clones by name and slug prefix", () => {
    assert.equal(
      isTestProfileLike({
        name: "QA Claim Ioanna Severi 1",
        slug: "qa-claim-ioanna-1",
        email: null,
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

  it("flags Auto Match integration orphans by name prefix", () => {
    assert.equal(
      isTestProfileLike({
        name: "Auto Match 1789459863391-62419",
        slug: "auto-match-registration-1789459863391-62419",
        email: "auto.match.1789459863391-62419@example.com",
        isTestProfile: false,
      }),
      true,
    );
  });
});

describe("isQaClaimDirectoryListing", () => {
  it("accepts name or slug prefixes only", () => {
    assert.equal(
      isQaClaimDirectoryListing({ name: "QA Claim Ioanna Severi 1", slug: "other" }),
      true,
    );
    assert.equal(
      isQaClaimDirectoryListing({ name: "Ioanna Severi", slug: "qa-claim-ioanna-1" }),
      true,
    );
    assert.equal(
      isQaClaimDirectoryListing({ name: "Ioanna Severi", slug: "ioanna-severi" }),
      false,
    );
  });
});

describe("isTestDoctorRegistrationEmail", () => {
  it("flags owner Gmail plus-aliases used for manual prod registration QA", () => {
    assert.equal(isTestDoctorRegistrationEmail("doccyteam+flow1@gmail.com"), true);
    assert.equal(isTestDoctorRegistrationEmail("rociosirvent+anastasia@gmail.com"), true);
    assert.equal(isTestDoctorRegistrationEmail("liviolanzo+cyprus@gmail.com"), true);
  });

  it("does not flag the same local-part without a plus tag", () => {
    assert.equal(isTestDoctorRegistrationEmail("doccyteam@gmail.com"), false);
    assert.equal(isTestDoctorRegistrationEmail("liviolanzo@gmail.com"), false);
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

describe("testing vs prod claim restriction", () => {
  it("detects the testing Supabase project ref", () => {
    assert.equal(
      isDocCyTestingSupabaseProject("https://fwinchqdgrkpxuuttech.supabase.co"),
      true,
    );
    assert.equal(
      isDocCyTestingSupabaseProject("https://oiwlztcduxojadbcxkil.supabase.co"),
      false,
    );
  });

  it("allows test emails to claim real listings only on the testing DB", () => {
    assert.equal(
      restrictTestSignupDirectoryClaimsToQaListings(
        "https://fwinchqdgrkpxuuttech.supabase.co",
      ),
      false,
    );
    assert.equal(
      restrictTestSignupDirectoryClaimsToQaListings(
        "https://oiwlztcduxojadbcxkil.supabase.co",
      ),
      true,
    );
  });
});
