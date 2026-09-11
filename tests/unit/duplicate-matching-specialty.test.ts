import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDuplicateSuggestions } from "../../lib/duplicate-matching";
import { parseProfessionalListingRef } from "../../lib/parse-professional-listing-ref";

describe("buildDuplicateSuggestions specialty harmonize", () => {
  it("treats Dentistry and Dentist as the same specialty for twin score", () => {
    const suggestions = buildDuplicateSuggestions(
      [
        {
          id: "man-1",
          name: "QA Twin Manual Doctor",
          specialty: "Dentistry",
          district: "Limassol",
        },
      ],
      [
        {
          id: "reg-1",
          name: "QA Twin Manual Doctor",
          specialty: "Dentist",
          district: "Limassol",
        },
      ],
    );
    assert.equal(suggestions.length, 1);
    assert.ok(suggestions[0]!.score >= 0.85);
    assert.match(suggestions[0]!.reason, /same specialty/);
  });
});

describe("parseProfessionalListingRef", () => {
  it("reads slug from local public profile URLs", () => {
    assert.deepEqual(
      parseProfessionalListingRef("http://localhost:3000/en/qa-twin-manual-1789141084040"),
      { kind: "slug", value: "qa-twin-manual-1789141084040" },
    );
    assert.deepEqual(parseProfessionalListingRef("/en/qa-twin-manual-1789141084040"), {
      kind: "slug",
      value: "qa-twin-manual-1789141084040",
    });
  });

  it("accepts a bare UUID", () => {
    assert.deepEqual(
      parseProfessionalListingRef("87752295-9381-4d70-b752-ab8edb3a5e9a"),
      { kind: "uuid", value: "87752295-9381-4d70-b752-ab8edb3a5e9a" },
    );
  });
});
