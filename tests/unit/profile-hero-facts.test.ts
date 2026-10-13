import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { formatServicePrice } from "../../lib/public/service-price";
import { profileDistricts } from "../../lib/public/profile-districts";

describe("formatServicePrice", () => {
  it("puts the euro sign before the amount, as Settings shows it to her", () => {
    assert.equal(formatServicePrice("100"), "€100");
    assert.equal(formatServicePrice("  60 "), "€60");
    assert.equal(formatServicePrice("45.50"), "€45.50");
    // Older free text that is only a number or a range.
    assert.equal(formatServicePrice("45,50"), "€45,50");
    assert.equal(formatServicePrice("50-80"), "€50-80");
  });

  it("a lowest price (her 'From' tick) gets the sign too (user, 2026-10-13)", () => {
    assert.equal(formatServicePrice("From 95"), "From €95");
    assert.equal(formatServicePrice("from 49.50"), "From €49.50");
    // The page passes its own word for "From" (Greek).
    assert.equal(formatServicePrice("From 95", (price) => `Από ${price}`), "Από €95");
    for (const file of ["messages/en.json", "messages/el.json"]) {
      const messages = JSON.parse(readFileSync(join(process.cwd(), file), "utf8")).DoctorProfilePage;
      assert.match(messages.servicePriceFrom, /\{price\}/, file);
    }
    const section = readFileSync(
      join(process.cwd(), "components/doctor/profile/ProfileServicesSection.tsx"),
      "utf8",
    );
    assert.match(section, /t\("servicePriceFrom", \{ price \}\)/);
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
