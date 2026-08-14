import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalizeCyprusTown,
  districtForTown,
  inferCyprusTownFromClinic,
  reconcileFinderTownAndDistrict,
  resolveFinderTownQuery,
  resolveFinderTownSubmit,
  slugToTown,
  suggestFinderTowns,
  townToSlug,
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
  it("fills town from a stored clinic_address when the town column is empty", () => {
    assert.equal(
      inferCyprusTownFromClinic({
        town: null,
        address: "Akropoleos Avenue 71, Strovolos, 2012, Nicosia, Cyprus",
      }),
      "Strovolos",
    );
  });

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

describe("finder town typeahead", () => {
  it("waits for 3 characters and scopes suggestions to the selected district", () => {
    assert.deepEqual(suggestFinderTowns("ta", "Paphos"), []);
    const paphos = suggestFinderTowns("tal", "Paphos");
    assert.equal(paphos.length, 1);
    assert.equal(paphos[0]?.name, "Tala");
    assert.equal(paphos[0]?.district, "Paphos");
    assert.equal(
      suggestFinderTowns("tal", "Limassol").length,
      0,
    );
  });

  it("labels island-wide matches with their district", () => {
    const matches = suggestFinderTowns("stro");
    assert.equal(matches[0]?.name, "Strovolos");
    assert.equal(matches[0]?.district, "Nicosia");
  });

  it("round-trips town slugs and districts", () => {
    assert.equal(townToSlug("Tala"), "tala");
    assert.equal(slugToTown("tala"), "Tala");
    assert.equal(districtForTown("Tala"), "Paphos");
    assert.equal(slugToTown("pafos"), "Paphos");
    assert.equal(resolveFinderTownQuery("tala"), "Tala");
    assert.equal(resolveFinderTownQuery("Pafos"), "Paphos");
  });

  it("fills district from town and drops a mismatched path district", () => {
    assert.deepEqual(
      reconcileFinderTownAndDistrict({ town: "Tala", district: "" }),
      { town: "Tala", district: "Paphos" },
    );
    assert.deepEqual(
      reconcileFinderTownAndDistrict({ town: "Tala", district: "Paphos" }),
      { town: "Tala", district: "Paphos" },
    );
    assert.deepEqual(
      reconcileFinderTownAndDistrict({ town: "Tala", district: "Limassol" }),
      { town: "", district: "Limassol" },
    );
  });

  it("resolves a typed town on Find, including a unique prefix", () => {
    assert.deepEqual(resolveFinderTownSubmit("Paphos", "tal"), {
      town: "Tala",
      district: "Paphos",
    });
    assert.deepEqual(resolveFinderTownSubmit("", "Tala"), {
      town: "Tala",
      district: "Paphos",
    });
    assert.deepEqual(resolveFinderTownSubmit("Limassol", "Tala"), {
      town: "",
      district: "Limassol",
    });
  });
});
