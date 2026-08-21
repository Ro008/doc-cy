import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildClinicsResultsHeading,
  buildClinicsResultsSnippet,
  buildFinderResultsHeading,
  buildFinderResultsSnippet,
} from "@/lib/finder-results-heading";

describe("buildFinderResultsHeading", () => {
  it("names specialty + district", () => {
    assert.equal(
      buildFinderResultsHeading({
        specialtyLabel: "Dermatology",
        districtLabel: "Paphos",
      }),
      "Dermatology in Paphos",
    );
  });

  it("handles district-only and specialty-only", () => {
    assert.equal(
      buildFinderResultsHeading({ districtLabel: "Limassol" }),
      "Health professionals in Limassol",
    );
    assert.equal(
      buildFinderResultsHeading({ specialtyLabel: "Dentistry" }),
      "Dentistry in Cyprus",
    );
  });

  it("falls back when unfiltered", () => {
    assert.equal(
      buildFinderResultsHeading({}),
      "The most complete health directory in Cyprus",
    );
  });

  it("uses near you copy when GPS is the only place filter", () => {
    assert.equal(
      buildFinderResultsHeading({ nearYou: true }),
      "Health professionals near you",
    );
    assert.equal(
      buildFinderResultsHeading({
        nearYou: true,
        specialtyLabel: "Dentistry",
      }),
      "Dentistry near you",
    );
  });
});

describe("buildFinderResultsSnippet", () => {
  it("uses island coverage for specialty-only", () => {
    assert.equal(
      buildFinderResultsSnippet({ specialtyLabel: "Gynecology" }),
      "Find a specialist anywhere on the island",
    );
  });

  it("uses district coverage when a place is set", () => {
    assert.equal(
      buildFinderResultsSnippet({
        specialtyLabel: "Gynecology",
        districtLabel: "Paphos",
      }),
      "Find a specialist in this district",
    );
    assert.equal(
      buildFinderResultsSnippet({ districtLabel: "Limassol" }),
      "Find any specialist in this district",
    );
  });

  it("uses area coverage for GPS-only", () => {
    assert.equal(
      buildFinderResultsSnippet({ nearYou: true }),
      "Find any specialist in your area",
    );
    assert.equal(
      buildFinderResultsSnippet({
        nearYou: true,
        specialtyLabel: "Hematology",
      }),
      "Find a specialist in your area",
    );
  });

  it("returns null when unfiltered", () => {
    assert.equal(buildFinderResultsSnippet({}), null);
  });
});

describe("buildClinicsResultsHeading", () => {
  it("builds clinic search headings", () => {
    assert.equal(
      buildClinicsResultsHeading({}),
      "The largest directory of clinics in Cyprus",
    );
    assert.equal(
      buildClinicsResultsHeading({ districtLabel: "Paphos" }),
      "Clinics in Paphos",
    );
    assert.equal(
      buildClinicsResultsHeading({ districtLabel: "Geroskipou" }),
      "Clinics in Geroskipou",
    );
    assert.equal(
      buildClinicsResultsHeading({ nearYou: true }),
      "Clinics near you",
    );
  });
});

describe("buildClinicsResultsSnippet", () => {
  it("uses coverage copy by place", () => {
    assert.equal(buildClinicsResultsSnippet({}), null);
    assert.equal(
      buildClinicsResultsSnippet({ districtLabel: "Limassol" }),
      "Find a clinic in this district",
    );
    assert.equal(
      buildClinicsResultsSnippet({ nearYou: true }),
      "Find a clinic in your area",
    );
  });
});
