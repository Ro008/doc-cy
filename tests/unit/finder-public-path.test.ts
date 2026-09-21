import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalFinderSpecialtyRedirectPath,
  finderResultsPath,
  isLegacyFinderFilterPath,
  isPatientDirectoryChromePath,
  isProfessionalMarketingPath,
  isPublicFinderResultsPath,
  legacyFinderFilterToPublicPath,
  needsMiddlewareFinderRewrite,
  publicFinderPathToInternal,
} from "@/lib/finder-public-path";

describe("finder public paths", () => {
  it("builds canonical public result URLs", () => {
    assert.equal(finderResultsPath(null, null), "/");
    assert.equal(finderResultsPath("Larnaca", null), "/larnaca");
    assert.equal(finderResultsPath("Larnaca", "Dentistry"), "/larnaca/dentistry");
    assert.equal(finderResultsPath(null, "Gynecology"), "/all/gynecology");
  });

  it("maps legacy /finder filter URLs to public paths", () => {
    assert.equal(isLegacyFinderFilterPath("/finder"), true);
    assert.equal(isLegacyFinderFilterPath("/finder/paphos/dentistry"), true);
    assert.equal(isLegacyFinderFilterPath("/finder/professional/x"), false);
    assert.equal(isLegacyFinderFilterPath("/finder/clinic/y"), false);
    assert.equal(legacyFinderFilterToPublicPath("/finder"), "/");
    assert.equal(legacyFinderFilterToPublicPath("/finder/paphos"), "/paphos");
  });

  it("does not rewrite public finder URLs (real App Router district pages)", () => {
    assert.equal(isPublicFinderResultsPath("/"), true);
    assert.equal(isPublicFinderResultsPath("/larnaca/dentistry"), true);
    assert.equal(isPublicFinderResultsPath("/andreas-nikos"), false);
    assert.equal(needsMiddlewareFinderRewrite("/"), false);
    assert.equal(needsMiddlewareFinderRewrite("/larnaca"), false);
    assert.equal(needsMiddlewareFinderRewrite("/all/gynecology"), false);
    assert.equal(publicFinderPathToInternal("/"), "/finder");
    assert.equal(publicFinderPathToInternal("/larnaca"), "/finder/larnaca");
  });

  it("detects professional marketing paths", () => {
    assert.equal(isProfessionalMarketingPath("/for-professionals"), true);
    assert.equal(isProfessionalMarketingPath("/for-professionals/"), true);
    assert.equal(isProfessionalMarketingPath("/en"), true);
    assert.equal(isProfessionalMarketingPath("/el"), true);
    assert.equal(isProfessionalMarketingPath("/"), false);
    assert.equal(isProfessionalMarketingPath("/agenda"), false);
  });

  it("detects patient directory chrome paths", () => {
    assert.equal(isPatientDirectoryChromePath("/"), true);
    assert.equal(isPatientDirectoryChromePath("/larnaca"), true);
    assert.equal(isPatientDirectoryChromePath("/larnaca/dentistry"), true);
    assert.equal(isPatientDirectoryChromePath("/clinics"), true);
    assert.equal(isPatientDirectoryChromePath("/clinics/paphos"), true);
    assert.equal(isPatientDirectoryChromePath("/for-professionals"), false);
    assert.equal(isPatientDirectoryChromePath("/agenda"), false);
    assert.equal(isPatientDirectoryChromePath("/finder/professional/maria"), false);
  });
});

describe("canonicalFinderSpecialtyRedirectPath (308 for legacy specialty URLs)", () => {
  it("redirects legacy spellings to the catalogue slug", () => {
    assert.equal(canonicalFinderSpecialtyRedirectPath("/paphos/dentistry"), "/paphos/dentist");
    assert.equal(canonicalFinderSpecialtyRedirectPath("/all/gynecology"), "/all/obstetrics-gynaecology");
    assert.equal(canonicalFinderSpecialtyRedirectPath("/paphos/pediatrics"), "/paphos/paediatrics");
    assert.equal(canonicalFinderSpecialtyRedirectPath("/paphos/dermatology"), "/paphos/dermato-venereology");
    assert.equal(canonicalFinderSpecialtyRedirectPath("/limassol/haematology"), "/limassol/hematology");
    assert.equal(canonicalFinderSpecialtyRedirectPath("/all/midwifery"), "/all/midwife");
    assert.equal(canonicalFinderSpecialtyRedirectPath("/all/ent"), "/all/otorhinolaryngology");
  });

  it("normalizes casing", () => {
    assert.equal(canonicalFinderSpecialtyRedirectPath("/limassol/PAEDIATRICS"), "/limassol/paediatrics");
  });

  it("leaves canonical, custom and non-finder paths alone", () => {
    for (const path of [
      "/limassol/paediatrics",
      "/all/obstetrics-gynaecology",
      "/all/thoracic-surgery-cardio-surgery",
      "/all/sexology",
      "/all/psychology",
      "/all/clinical-psychologist",
      "/limassol/all",
      "/limassol",
      "/",
      "/dr-maria-georgiou",
      "/clinics/paphos",
      "/limassol/paediatrics/extra",
    ]) {
      assert.equal(canonicalFinderSpecialtyRedirectPath(path), null, path);
    }
  });
});
