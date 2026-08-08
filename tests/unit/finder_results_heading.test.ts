import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildClinicsResultsHeading,
  buildFinderResultsHeading,
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
});

describe("buildClinicsResultsHeading", () => {
  it("builds clinic search headings", () => {
    assert.equal(buildClinicsResultsHeading({}), "Find clinics in Cyprus");
    assert.equal(
      buildClinicsResultsHeading({ districtLabel: "Paphos" }),
      "Find clinics in Paphos",
    );
  });
});
