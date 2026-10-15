import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFinderClinicCards,
  orderFinderClinicCards,
  type FinderCardPlace,
  type FinderClinicCard,
  type FinderClinicCardSource,
} from "@/lib/finder-clinic-cards";

// One finder card per professional + clinic (user, 2026-10-15): the card stands for one
// clinic matching the search, and ranks by what a patient can do at that clinic.

function place(
  clinicId: string,
  district: string,
  extra: Partial<FinderCardPlace> = {},
): FinderCardPlace {
  return {
    clinicId,
    linkId: `link-${clinicId}`,
    district,
    town: null,
    latitude: null,
    longitude: null,
    pausedOnline: false,
    ...extra,
  };
}

type Row = { id: string; name: string };

function registered(
  id: string,
  places: FinderCardPlace[],
  hasProAccess = true,
): FinderClinicCardSource<Row> {
  return { kind: "registered", professionalId: id, row: { id, name: id }, places, hasProAccess };
}

function listing(id: string, places: FinderCardPlace[]): FinderClinicCardSource<Row> {
  return {
    kind: "manual",
    professionalId: id,
    row: { id, name: id },
    places: places.map((p) => ({ ...p, linkId: null, pausedOnline: true })),
    hasProAccess: false,
  };
}

const noPlace = { district: "", town: "", coords: null };

function keys(cards: readonly FinderClinicCard<Row>[]): string[] {
  return cards.map((card) => `${card.professionalId}@${card.place?.clinicId ?? "-"}`);
}

describe("buildFinderClinicCards", () => {
  it("shows only the clinic in the searched district", () => {
    const cards = buildFinderClinicCards(
      [registered("anna", [place("nic", "Nicosia"), place("paf", "Paphos")])],
      { ...noPlace, district: "Paphos" },
    );
    assert.deepEqual(keys(cards), ["anna@paf"]);
  });

  it("matches the district whatever its case", () => {
    const cards = buildFinderClinicCards(
      [registered("anna", [place("paf", "paphos")])],
      { ...noPlace, district: "Paphos" },
    );
    assert.deepEqual(keys(cards), ["anna@paf"]);
  });

  it("gives one card per clinic when no place is searched, in her clinic order", () => {
    const cards = buildFinderClinicCards(
      [registered("anna", [place("nic", "Nicosia"), place("lim", "Limassol"), place("paf", "Paphos")])],
      noPlace,
    );
    assert.deepEqual(keys(cards), ["anna@nic", "anna@lim", "anna@paf"]);
  });

  it("gives one card per matching clinic when two are in the district", () => {
    const cards = buildFinderClinicCards(
      [registered("anna", [place("nic1", "Nicosia"), place("lim", "Limassol"), place("nic2", "Nicosia")])],
      { ...noPlace, district: "Nicosia" },
    );
    assert.deepEqual(keys(cards), ["anna@nic1", "anna@nic2"]);
  });

  it("matches the town through the finder's town names", () => {
    const cards = buildFinderClinicCards(
      [
        listing("lena", [
          place("str", "Nicosia", { town: "Strovolos" }),
          place("lak", "Nicosia", { town: "Lakatamia" }),
        ]),
      ],
      { district: "Nicosia", town: "Strovolos", coords: null },
    );
    assert.deepEqual(keys(cards), ["lena@str"]);
  });

  it("leaves out a professional with no clinic in the place", () => {
    const cards = buildFinderClinicCards(
      [registered("anna", [place("nic", "Nicosia")])],
      { ...noPlace, district: "Paphos" },
    );
    assert.deepEqual(cards, []);
  });

  it("keeps a professional with no clinic at all as one card when no place is searched", () => {
    assert.deepEqual(keys(buildFinderClinicCards([listing("lena", [])], noPlace)), ["lena@-"]);
    assert.deepEqual(
      buildFinderClinicCards([listing("lena", [])], { ...noPlace, district: "Paphos" }),
      [],
    );
  });

  it("gives every card a unique key", () => {
    const cards = buildFinderClinicCards(
      [
        registered("anna", [place("nic", "Nicosia"), place("lim", "Limassol")]),
        listing("anna-listing", [place("nic", "Nicosia")]),
      ],
      noPlace,
    );
    const cardKeys = cards.map((card) => card.key);
    assert.equal(new Set(cardKeys).size, cardKeys.length);
  });

  it("measures near-me distance to the card's own clinic", () => {
    const cards = buildFinderClinicCards(
      [
        registered("anna", [
          place("nic", "Nicosia", { latitude: 35.17, longitude: 33.36 }),
          place("paf", "Paphos", { latitude: 34.77, longitude: 32.42 }),
        ]),
      ],
      { ...noPlace, coords: { latitude: 34.77, longitude: 32.42 } },
    );
    const paphos = cards.find((card) => card.place?.clinicId === "paf");
    const nicosia = cards.find((card) => card.place?.clinicId === "nic");
    assert.ok(paphos && nicosia);
    assert.ok((paphos.distanceKm ?? Infinity) < 1);
    assert.ok((nicosia.distanceKm ?? 0) > 50);
  });

  it("books online only at an open clinic of a professional with access", () => {
    const cards = buildFinderClinicCards(
      [
        registered("anna", [place("open", "Nicosia"), place("paused", "Nicosia", { pausedOnline: true })]),
        registered("ended", [place("e1", "Nicosia")], false),
        listing("lena", [place("l1", "Nicosia")]),
      ],
      noPlace,
    );
    const byKey = new Map(cards.map((card) => [`${card.professionalId}@${card.place?.clinicId}`, card]));
    assert.equal(byKey.get("anna@open")?.hasOnlineBooking, true);
    assert.equal(byKey.get("anna@paused")?.hasOnlineBooking, false);
    assert.equal(byKey.get("ended@e1")?.hasOnlineBooking, false);
    assert.equal(byKey.get("lena@l1")?.hasOnlineBooking, false);
    assert.equal(byKey.get("anna@paused")?.isRegistered, true);
    assert.equal(byKey.get("lena@l1")?.isRegistered, false);
  });
});

describe("orderFinderClinicCards", () => {
  const order = (
    cards: FinderClinicCard<Row>[],
    options: { seed?: string; nearMe?: boolean; requests?: Record<string, number> } = {},
  ) =>
    orderFinderClinicCards(cards, {
      nearMe: Boolean(options.nearMe),
      shuffleSeed: options.seed ?? "seed",
      getRequestCount: (card) => options.requests?.[card.professionalId] ?? 0,
    });

  it("puts a paused clinic after every other professional's bookable clinic", () => {
    // The user's example: her open clinic ranks with the bookable cards, her paused
    // clinic after all of them.
    const cards = buildFinderClinicCards(
      [
        registered("anna", [place("open", "Paphos"), place("paused", "Paphos", { pausedOnline: true })]),
        registered("bob", [place("b1", "Paphos")]),
        registered("carl", [place("c1", "Paphos")]),
        listing("lena", [place("l1", "Paphos")]),
      ],
      { ...noPlace, district: "Paphos" },
    );
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const ordered = keys(order(cards, { seed }));
      assert.deepEqual(ordered.slice(0, 3).sort(), ["anna@open", "bob@b1", "carl@c1"]);
      assert.deepEqual(ordered.slice(3), ["anna@paused", "lena@l1"]);
    }
  });

  it("ranks registered cards without booking before unregistered listings", () => {
    const cards = buildFinderClinicCards(
      [listing("lena", [place("l1", "Nicosia")]), registered("ended", [place("e1", "Nicosia")], false)],
      noPlace,
    );
    assert.deepEqual(keys(order(cards)), ["ended@e1", "lena@l1"]);
  });

  it("keeps a professional's cards of the same tier together, in her clinic order", () => {
    const cards = buildFinderClinicCards(
      [
        registered("anna", [place("a1", "Nicosia"), place("a2", "Limassol"), place("a3", "Paphos")]),
        registered("bob", [place("b1", "Nicosia")]),
        registered("carl", [place("c1", "Nicosia")]),
        registered("dina", [place("d1", "Nicosia")]),
      ],
      noPlace,
    );
    for (const seed of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
      const ordered = keys(order(cards, { seed }));
      const start = ordered.indexOf("anna@a1");
      assert.deepEqual(ordered.slice(start, start + 3), ["anna@a1", "anna@a2", "anna@a3"]);
    }
  });

  it("shuffles professionals, not cards, so more clinics is not a better place", () => {
    const cards = buildFinderClinicCards(
      [
        registered("anna", [place("a1", "Nicosia"), place("a2", "Nicosia"), place("a3", "Nicosia")]),
        registered("bob", [place("b1", "Nicosia")]),
      ],
      noPlace,
    );
    const firsts = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      firsts.add(order(cards, { seed: `s${i}` })[0]!.professionalId);
    }
    assert.deepEqual([...firsts].sort(), ["anna", "bob"]);
  });

  it("orders the same way for the same seed", () => {
    const cards = buildFinderClinicCards(
      ["a", "b", "c", "d", "e"].map((id) => registered(id, [place(`${id}1`, "Nicosia")])),
      noPlace,
    );
    assert.deepEqual(keys(order(cards, { seed: "x" })), keys(order(cards, { seed: "x" })));
  });

  it("orders unregistered listings by their online-booking requests, highest first", () => {
    const cards = buildFinderClinicCards(
      [
        listing("few", [place("f1", "Nicosia")]),
        listing("most", [place("m1", "Nicosia"), place("m2", "Limassol")]),
        listing("none", [place("n1", "Nicosia")]),
      ],
      noPlace,
    );
    for (const seed of ["a", "b", "c"]) {
      assert.deepEqual(keys(order(cards, { seed, requests: { most: 9, few: 2 } })), [
        "most@m1",
        "most@m2",
        "few@f1",
        "none@n1",
      ]);
    }
  });

  it("near me: sorts each tier by the distance to each card's clinic", () => {
    const cards = buildFinderClinicCards(
      [
        registered("anna", [
          place("far", "Nicosia", { latitude: 35.17, longitude: 33.36 }),
          place("near", "Paphos", { latitude: 34.775, longitude: 32.425 }),
        ]),
        registered("bob", [place("mid", "Paphos", { latitude: 34.9, longitude: 32.6 })]),
        listing("lena", [place("l1", "Paphos", { latitude: 34.77, longitude: 32.42 })]),
      ],
      { ...noPlace, coords: { latitude: 34.77, longitude: 32.42 } },
    );
    assert.deepEqual(keys(order(cards, { nearMe: true })), [
      "anna@near",
      "bob@mid",
      "anna@far",
      "lena@l1",
    ]);
  });
});
