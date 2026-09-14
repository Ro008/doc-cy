import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseProfessionalListingRef } from "../../lib/parse-professional-listing-ref";

describe("parseProfessionalListingRef", () => {
  it("reads slug from locale path", () => {
    const ref = parseProfessionalListingRef("https://mydoccy.com/en/dr-example");
    assert.deepEqual(ref, { kind: "slug", value: "dr-example" });
  });

  it("reads uuid directly", () => {
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const ref = parseProfessionalListingRef(id);
    assert.deepEqual(ref, { kind: "uuid", value: id });
  });
});
