import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { originFromClaimSource, parseDirectoryClaimSource } from "../../lib/pending-registration-origin";

describe("registration origin badge", () => {
  it("maps card_link to Claimed", () => {
    const origin = originFromClaimSource("card_link");
    assert.equal(origin.kind, "claimed");
    assert.equal(origin.label, "Claimed");
  });

  it("maps email / name match and no source to Unclaimed", () => {
    assert.equal(originFromClaimSource("email").kind, "unclaimed");
    assert.equal(originFromClaimSource("name_specialty_district").kind, "unclaimed");
    const none = originFromClaimSource(null);
    assert.equal(none.kind, "unclaimed");
    assert.equal(none.label, "Unclaimed");
  });

  it("parses only known claim sources", () => {
    assert.equal(parseDirectoryClaimSource(" card_link "), "card_link");
    assert.equal(parseDirectoryClaimSource("something"), null);
    assert.equal(parseDirectoryClaimSource(null), null);
  });
});
