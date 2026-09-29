import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REGISTER_CLINIC_SEARCH_LIMIT,
  REGISTER_CLINIC_SEARCH_MIN_QUERY,
  clinicSearchTokens,
  normalizeClinicSearchText,
  rankClinicSearchResults,
  sameClinicAddress,
  withoutTakenClinics,
  type ClinicSearchCandidate,
} from "../../lib/register-clinic-search";
import { registerClinicInputNames } from "../../lib/register-clinic-location";

function clinic(partial: Partial<ClinicSearchCandidate> & { name: string }): ClinicSearchCandidate {
  return {
    id: partial.id ?? partial.name.toLowerCase().replace(/\W+/g, "-"),
    name: partial.name,
    address: partial.address ?? "",
    town: partial.town ?? null,
    district: partial.district ?? "Nicosia",
    latitude: partial.latitude ?? 35.1,
    longitude: partial.longitude ?? 33.3,
    placeId: partial.placeId ?? null,
    professionalCount: partial.professionalCount ?? 1,
  };
}

describe("clinic search text", () => {
  it("ignores case, accents and punctuation", () => {
    assert.equal(normalizeClinicSearchText("  Ágios  Nikólaos-Clinic, Ltd. "), "agios nikolaos clinic ltd");
  });

  it("needs at least two characters before searching", () => {
    assert.equal(REGISTER_CLINIC_SEARCH_MIN_QUERY, 2);
    assert.deepEqual(clinicSearchTokens("a"), []);
    assert.deepEqual(clinicSearchTokens("  "), []);
    assert.deepEqual(clinicSearchTokens("Lefkotheou 20"), ["lefkotheou", "20"]);
  });
});

describe("clinic search ranking", () => {
  const polykliniki = clinic({
    name: "Polykliniki Ygeia Idiotiko Nosokomeio Limited",
    address: "Navpliou 21, Lemesos, 3025, Limassol",
    town: "Limassol",
    district: "Limassol",
    professionalCount: 40,
  });
  const giannikou = clinic({
    name: "Odontiatriki Polykliniki Giannikou Limited",
    address: "Alkaiou 8, Lefkosia, 1060, Nicosia",
    town: "Nicosia",
    professionalCount: 3,
  });
  const vouniotis = clinic({
    name: "Stelios Vouniotis I.E.P.E.",
    address: "Lefkotheou Leoforos 20, Strovolos, 2054, Nicosia",
    town: "Strovolos",
    professionalCount: 1,
  });

  it("matches the address and town as well as the name", () => {
    const byStreet = rankClinicSearchResults([polykliniki, giannikou, vouniotis], "lefkotheou 20");
    assert.deepEqual(byStreet.map((c) => c.id), [vouniotis.id]);
    const byTown = rankClinicSearchResults([polykliniki, giannikou, vouniotis], "strovolos");
    assert.deepEqual(byTown.map((c) => c.id), [vouniotis.id]);
  });

  it("needs every word to match somewhere", () => {
    assert.deepEqual(
      rankClinicSearchResults([polykliniki, giannikou], "polykliniki lemesos").map((c) => c.id),
      [polykliniki.id],
    );
  });

  it("puts names that start with the query first, then clinics with more professionals", () => {
    const ranked = rankClinicSearchResults([giannikou, polykliniki], "polyk");
    // "Polykliniki Ygeia…" starts with the query; "Odontiatriki Polykliniki…" only contains it.
    assert.deepEqual(ranked.map((c) => c.id), [polykliniki.id, giannikou.id]);

    const tie = rankClinicSearchResults(
      [clinic({ name: "Kentro A", professionalCount: 2 }), clinic({ name: "Kentro B", professionalCount: 9 })],
      "kentro",
    );
    assert.deepEqual(tie.map((c) => c.name), ["Kentro B", "Kentro A"]);
  });

  it("returns at most the result limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => clinic({ name: `Kentro Ygeias ${i}` }));
    assert.equal(rankClinicSearchResults(many, "kentro").length, REGISTER_CLINIC_SEARCH_LIMIT);
    assert.equal(REGISTER_CLINIC_SEARCH_LIMIT, 8);
  });

  it("returns nothing for a too-short query", () => {
    assert.deepEqual(rankClinicSearchResults([polykliniki], "p"), []);
  });
});

describe("register clinic form fields", () => {
  it("posts the chosen DocCy clinic id next to each clinic address", () => {
    assert.equal(registerClinicInputNames(0).clinicId, "clinicId");
    assert.equal(registerClinicInputNames(2).clinicId, "clinic2Id");
  });
});

describe("clinics already added in another row", () => {
  it("compares addresses ignoring case, accents and punctuation", () => {
    assert.equal(sameClinicAddress("12 Makariou Ave., Nicosia", "12 makariou ave nicosia"), true);
    assert.equal(sameClinicAddress("12 Makariou Ave", "14 Makariou Ave"), false);
    assert.equal(sameClinicAddress("", ""), false);
  });

  it("drops only the clinics picked elsewhere, not their neighbours in the same building", () => {
    const a = clinic({ id: "a", name: "Alpha", address: "20 Lefkotheou Ave, Nicosia" });
    const b = clinic({ id: "b", name: "Beta", address: "20 Lefkotheou Ave, Nicosia" });
    const c = clinic({ id: "c", name: "Gamma", address: "3 Gamma St, Paphos" });
    assert.deepEqual(
      withoutTakenClinics([a, b, c], ["a"]).map((x) => x.id),
      ["b", "c"],
    );
  });

  it("keeps everything when nothing else is taken", () => {
    const a = clinic({ id: "a", name: "Alpha", address: "1 Alpha St" });
    assert.equal(withoutTakenClinics([a], []).length, 1);
  });
});
