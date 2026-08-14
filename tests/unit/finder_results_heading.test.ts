import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildClinicsResultsHeading,
  buildFinderResultsHeading,
  buildFinderResultsSnippet,
} from "@/lib/finder-results-heading";

describe("buildFinderResultsHeading", () => {
  it("builds action H1 for specialty + district", () => {
    assert.equal(
      buildFinderResultsHeading({
        specialtyLabel: "Dermatology",
        districtLabel: "Paphos",
      }),
      "Book a Dermatology appointment in Paphos",
    );
  });

  it("uses an before vowel specialties", () => {
    assert.equal(
      buildFinderResultsHeading({
        specialtyLabel: "Orthopedics",
        districtLabel: "Nicosia",
      }),
      "Book an Orthopedics appointment in Nicosia",
    );
  });

  it("handles district-only and specialty-only", () => {
    assert.equal(
      buildFinderResultsHeading({ districtLabel: "Limassol" }),
      "Book an appointment in Limassol",
    );
    assert.equal(
      buildFinderResultsHeading({ specialtyLabel: "Dentistry" }),
      "Book a Dentistry appointment in Cyprus",
    );
  });

  it("falls back when unfiltered", () => {
    assert.equal(
      buildFinderResultsHeading({}),
      "Find your next health professional in Cyprus",
    );
  });

  it("uses near you copy when GPS is the only place filter", () => {
    assert.equal(
      buildFinderResultsHeading({ nearYou: true }),
      "Find professionals near you",
    );
    assert.equal(
      buildFinderResultsHeading({
        nearYou: true,
        specialtyLabel: "Dentistry",
      }),
      "Book a Dentistry appointment near you",
    );
  });
});

describe("buildFinderResultsSnippet", () => {
  it("uses professionals in specialty for all specialty combinations", () => {
    assert.equal(
      buildFinderResultsSnippet({ specialtyLabel: "Gynecology" }),
      "Find English-speaking professionals in Gynecology. Compare profiles and book online with confidence.",
    );
    assert.equal(
      buildFinderResultsSnippet({
        specialtyLabel: "Gynecology",
        districtLabel: "Paphos",
      }),
      "Find English-speaking professionals in Gynecology. Compare profiles and book online with confidence.",
    );
  });

  it("uses district when specialty is absent", () => {
    assert.equal(
      buildFinderResultsSnippet({ districtLabel: "Limassol" }),
      "Find English-speaking professionals in Limassol. Compare profiles and book online with confidence.",
    );
  });

  it("returns null when unfiltered", () => {
    assert.equal(buildFinderResultsSnippet({}), null);
  });
});

describe("buildClinicsResultsHeading", () => {
  it("builds clinic search headings", () => {
    assert.equal(buildClinicsResultsHeading({}), "Find clinics in Cyprus");
    assert.equal(
      buildClinicsResultsHeading({ districtLabel: "Paphos" }),
      "Find clinics in Paphos",
    );
    assert.equal(
      buildClinicsResultsHeading({ districtLabel: "Geroskipou" }),
      "Find clinics in Geroskipou",
    );
    assert.equal(
      buildClinicsResultsHeading({ nearYou: true }),
      "Find clinics near you",
    );
  });
});
