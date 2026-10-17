import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FINDER_NAME_SUGGESTION_LIMIT,
  finderNameInitials,
  normalizeFinderNameQuery,
  resolveFinderWhoSubmit,
  shapeFinderNameSuggestions,
  splitFinderMatch,
} from "../../lib/finder-who-search";

const specialties = [
  { slug: "cardiologist", label: "Cardiologist" },
  { slug: "cardiothoracic-surgery", label: "Cardiothoracic Surgery" },
  { slug: "dentist", label: "Dentist" },
];

describe("one field for Specialty or name (Finder R3; user, 2026-10-16)", () => {
  it("an empty field searches everyone", () => {
    assert.deepEqual(resolveFinderWhoSubmit("", specialties), { kind: "all" });
    assert.deepEqual(resolveFinderWhoSubmit("   ", specialties), { kind: "all" });
  });

  it("a specialty's name (any case, or its slug) runs a specialty search", () => {
    assert.deepEqual(resolveFinderWhoSubmit("dentist", specialties), { kind: "specialty", slug: "dentist" });
    assert.deepEqual(resolveFinderWhoSubmit("  CARDIOLOGIST ", specialties), {
      kind: "specialty",
      slug: "cardiologist",
    });
    assert.deepEqual(resolveFinderWhoSubmit("cardiothoracic-surgery", specialties), {
      kind: "specialty",
      slug: "cardiothoracic-surgery",
    });
  });

  it("anything else is a name search, part of a specialty included", () => {
    assert.deepEqual(resolveFinderWhoSubmit("Maria  Georgiou", specialties), { kind: "name", name: "Maria Georgiou" });
    assert.deepEqual(resolveFinderWhoSubmit("card", specialties), { kind: "name", name: "card" });
  });
});

describe("the suggestions show what matched", () => {
  it("splits the label around the typed text, whatever its case", () => {
    assert.deepEqual(splitFinderMatch("Cardiologist", "car"), { before: "", hit: "Car", after: "diologist" });
    assert.deepEqual(splitFinderMatch("Oscar Kyriakou", "CAR"), { before: "Os", hit: "car", after: " Kyriakou" });
  });

  it("no match leaves the label whole", () => {
    assert.deepEqual(splitFinderMatch("Dentist", "xyz"), { before: "Dentist", hit: "", after: "" });
    assert.deepEqual(splitFinderMatch("Dentist", ""), { before: "Dentist", hit: "", after: "" });
  });

  it("initials from the first and last name, without a title", () => {
    assert.equal(finderNameInitials("Carla Ioannou"), "CI");
    assert.equal(finderNameInitials("Dr. Andreas Nikos Petrou"), "AP");
    assert.equal(finderNameInitials("Μαρία Γεωργίου"), "ΜΓ");
    assert.equal(finderNameInitials("Plato"), "P");
    assert.equal(finderNameInitials("  "), "");
  });
});

describe("the name lookup", () => {
  it("needs two letters, trims and caps what is sent", () => {
    assert.equal(normalizeFinderNameQuery("a"), "");
    assert.equal(normalizeFinderNameQuery("  car  "), "car");
    assert.equal(normalizeFinderNameQuery("Maria   Georgiou"), "Maria Georgiou");
    assert.equal(normalizeFinderNameQuery("x".repeat(200)).length, 60);
    assert.equal(normalizeFinderNameQuery(null), "");
  });

  it("five at most, registered professionals first, then by name", () => {
    const rows = [
      { id: "1", name: "Carla Ioannou", slug: "carla-ioannou", isRegistered: false, ownPhotoUrl: null, specialty: "Dermatologist", district: "Limassol" },
      { id: "2", name: "Oscar Kyriakou", slug: "oscar-kyriakou", isRegistered: true, ownPhotoUrl: "https://x/a.webp", specialty: "Paediatrician", district: "Paphos" },
      { id: "3", name: "Anna Carras", slug: "anna-carras", isRegistered: false, ownPhotoUrl: null, specialty: null, district: null },
      { id: "4", name: "B Car", slug: "b-car", isRegistered: false, ownPhotoUrl: null, specialty: "Dentist", district: "Nicosia" },
      { id: "5", name: "C Car", slug: "c-car", isRegistered: false, ownPhotoUrl: null, specialty: "Dentist", district: "Nicosia" },
      { id: "6", name: "D Car", slug: "d-car", isRegistered: false, ownPhotoUrl: null, specialty: "Dentist", district: "Nicosia" },
    ];
    const shaped = shapeFinderNameSuggestions(rows);
    assert.equal(FINDER_NAME_SUGGESTION_LIMIT, 5);
    assert.equal(shaped.length, 5);
    assert.deepEqual(
      shaped.map((s) => s.name),
      ["Oscar Kyriakou", "Anna Carras", "B Car", "C Car", "Carla Ioannou"],
    );
  });

  it("the photo only when it is her own; initials otherwise; specialty · district under the name", () => {
    const [registered, listing] = shapeFinderNameSuggestions([
      { id: "2", name: "Oscar Kyriakou", slug: "oscar-kyriakou", isRegistered: true, ownPhotoUrl: "https://x/a.webp", specialty: "Paediatrician", district: "Paphos" },
      { id: "3", name: "Anna Carras", slug: "anna-carras", isRegistered: false, ownPhotoUrl: null, specialty: null, district: null },
    ]);
    assert.deepEqual(registered, {
      id: "2",
      name: "Oscar Kyriakou",
      href: "/en/oscar-kyriakou",
      photoUrl: "https://x/a.webp",
      initials: "OK",
      meta: "Paediatrician · Paphos",
    });
    assert.equal(listing.photoUrl, null);
    assert.equal(listing.initials, "AC");
    assert.equal(listing.meta, "");
  });

  it("a row without a page is left out", () => {
    const shaped = shapeFinderNameSuggestions([
      { id: "1", name: "No Page", slug: null, isRegistered: false, ownPhotoUrl: null, specialty: null, district: null },
    ]);
    assert.deepEqual(shaped, []);
  });
});
