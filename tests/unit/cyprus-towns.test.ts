import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalizeCyprusTown,
  inferCyprusTownFromClinic,
} from "../../lib/cyprus-towns";

describe("canonicalizeCyprusTown", () => {
  it("maps GeSY and Google spellings to one label", () => {
    assert.equal(canonicalizeCyprusTown("Pafos"), "Paphos");
    assert.equal(canonicalizeCyprusTown("Paphos"), "Paphos");
    assert.equal(canonicalizeCyprusTown("Lakatamia"), "Lakatameia");
    assert.equal(canonicalizeCyprusTown("Engomi"), "Egkomi Lefkosias");
    assert.equal(canonicalizeCyprusTown("Ayia Napa"), "Agia Napa");
  });

  it("returns null for unknown labels", () => {
    assert.equal(canonicalizeCyprusTown("Madrid"), null);
    assert.equal(canonicalizeCyprusTown(""), null);
  });
});

describe("inferCyprusTownFromClinic", () => {
  it("prefers Google locality over district-looking address text", () => {
    assert.equal(
      inferCyprusTownFromClinic({
        address: "Akropoleos Avenue 71, Strovolos, 2012, Nicosia",
        addressComponents: [
          { long_name: "Strovolos", short_name: "Strovolos", types: ["locality"] },
          { long_name: "Nicosia", short_name: "Nicosia", types: ["administrative_area_level_1"] },
        ],
      }),
      "Strovolos",
    );
  });

  it("reads town from a formatted address when components are missing", () => {
    assert.equal(
      inferCyprusTownFromClinic({
        address: "Vasileos Constantinou XIII 87, Pafos 8021",
      }),
      "Paphos",
    );
    assert.equal(
      inferCyprusTownFromClinic({
        address: "1 Clinic Street, Tala, Paphos",
      }),
      "Tala",
    );
  });

  it("does not treat Pera as a substring of Peristerona", () => {
    assert.equal(
      inferCyprusTownFromClinic({
        address: "Main Road, Peristerona Lefkosias, Nicosia",
      }),
      "Peristerona Lefkosias",
    );
  });
});
