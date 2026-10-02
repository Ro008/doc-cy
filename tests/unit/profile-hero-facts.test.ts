import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatServicePrice } from "../../lib/public/service-price";
import { profileDistricts } from "../../lib/public/profile-districts";

describe("formatServicePrice", () => {
  it("adds the euro sign after a plain number", () => {
    assert.equal(formatServicePrice("100"), "100 €");
    assert.equal(formatServicePrice("  60 "), "60 €");
    assert.equal(formatServicePrice("45.50"), "45.50 €");
    assert.equal(formatServicePrice("45,50"), "45,50 €");
    assert.equal(formatServicePrice("50-80"), "50-80 €");
  });

  it("keeps a price the doctor already wrote with a currency or words", () => {
    assert.equal(formatServicePrice("120€"), "120€");
    assert.equal(formatServicePrice("From 50€"), "From 50€");
    assert.equal(formatServicePrice("€80"), "€80");
    assert.equal(formatServicePrice("80 EUR"), "80 EUR");
    assert.equal(formatServicePrice("On request"), "On request");
  });

  it("returns null when there is no price", () => {
    assert.equal(formatServicePrice(null), null);
    assert.equal(formatServicePrice(""), null);
    assert.equal(formatServicePrice("   "), null);
  });
});

describe("profileDistricts", () => {
  it("lists every district the professional has a clinic in, primary first", () => {
    assert.deepEqual(
      profileDistricts({
        locations: [{ district: "Nicosia" }, { district: "paphos" }],
        fallback: "Nicosia",
      }),
      ["Nicosia", "Paphos"],
    );
  });

  it("names a district once when several clinics share it", () => {
    assert.deepEqual(
      profileDistricts({
        locations: [{ district: "Limassol" }, { district: "Limassol" }, { district: null }],
        fallback: null,
      }),
      ["Limassol"],
    );
  });

  it("falls back to the profile district without clinic rows, and ignores unknown names", () => {
    assert.deepEqual(profileDistricts({ locations: [], fallback: "Larnaca" }), ["Larnaca"]);
    assert.deepEqual(
      profileDistricts({ locations: [{ district: "Atlantis" }], fallback: null }),
      [],
    );
  });
});
