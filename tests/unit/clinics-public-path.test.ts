import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clinicLandingPath, CLINIC_LANDING_BASE_PATH } from "@/lib/clinic-landing-path";
import {
  CLINICS_SEARCH_BASE,
  clinicsResultsPath,
  isClinicsSearchPath,
} from "@/lib/clinics-public-path";

describe("clinics public paths", () => {
  it("builds canonical clinic search URLs", () => {
    assert.equal(clinicsResultsPath(null), CLINICS_SEARCH_BASE);
    assert.equal(clinicsResultsPath(""), CLINICS_SEARCH_BASE);
    assert.equal(clinicsResultsPath("all"), CLINICS_SEARCH_BASE);
    assert.equal(clinicsResultsPath("Paphos"), "/clinics/paphos");
    assert.equal(clinicsResultsPath("larnaca"), "/clinics/larnaca");
  });

  it("builds clinic profile URLs under /clinics", () => {
    assert.equal(CLINIC_LANDING_BASE_PATH, "/clinics");
    assert.equal(clinicLandingPath("paphos-demo-clinic"), "/clinics/paphos-demo-clinic");
  });

  it("detects clinic search paths", () => {
    assert.equal(isClinicsSearchPath("/clinics"), true);
    assert.equal(isClinicsSearchPath("/clinics/paphos"), true);
    assert.equal(isClinicsSearchPath("/clinics/all"), false);
    assert.equal(isClinicsSearchPath("/clinics/paphos-demo-clinic"), false);
    assert.equal(isClinicsSearchPath("/paphos"), false);
    assert.equal(isClinicsSearchPath("/finder/clinic/x"), false);
  });
});
