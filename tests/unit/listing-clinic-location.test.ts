import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LISTING_CLINICS_SELECT,
  listingClinicLocations,
  pickListingCardClinic,
} from "@/lib/listing-clinic-location";

// Point E5: a listing's district, town, address, map link and pin come from its
// clinics (`professional_clinics`), never from copies on `professionals`.
const nicosia = {
  id: "c-nic",
  district: "Nicosia",
  town: "Strovolos",
  address: "Lemesou Avenue 215, Strovolos, 2029, Nicosia",
  address_maps_link: "https://www.google.com/maps?q=35.127812,33.37722",
  latitude: 35.127812,
  longitude: 33.37722,
  is_archived: false,
};
const limassol = {
  id: "c-lim",
  district: "Limassol",
  town: "Limassol",
  address: "Nikaias 1, Pano Polemidia, 4130, Limassol",
  address_maps_link: "https://www.google.com/maps?q=34.703699,32.988152",
  latitude: 34.703699,
  longitude: 32.988152,
  is_archived: false,
};
const larnaca = {
  id: "c-lar",
  district: "Larnaca",
  town: "Larnaca",
  address: "Nikou Dimitriou 36, Larnaka, 6031, Larnaca",
  address_maps_link: null,
  latitude: null,
  longitude: null,
  is_archived: false,
};

const row = {
  listing_clinics: [
    { is_primary: false, clinics: limassol },
    { is_primary: true, clinics: nicosia },
    { is_primary: false, clinics: { ...larnaca, id: "c-old", is_archived: true } },
    { is_primary: false, clinics: larnaca },
  ],
};

describe("listingClinicLocations", () => {
  it("selects the clinic fields through professional_clinics", () => {
    assert.equal(
      LISTING_CLINICS_SELECT,
      "listing_clinics:professional_clinics(is_primary, clinics(id, district, town, address, address_maps_link, latitude, longitude, is_archived))",
    );
  });

  it("lists unarchived clinics, primary first, keeping the order of the rest", () => {
    const locations = listingClinicLocations(row);
    assert.deepEqual(
      locations.map((loc) => [loc.clinicId, loc.isPrimary]),
      [
        ["c-nic", true],
        ["c-lim", false],
        ["c-lar", false],
      ],
    );
    assert.deepEqual(locations[0], {
      clinicId: "c-nic",
      isPrimary: true,
      district: "Nicosia",
      town: "Strovolos",
      address: "Lemesou Avenue 215, Strovolos, 2029, Nicosia",
      addressMapsLink: "https://www.google.com/maps?q=35.127812,33.37722",
      latitude: 35.127812,
      longitude: 33.37722,
    });
    assert.equal(locations[2]?.latitude, null);
    assert.equal(locations[2]?.addressMapsLink, null);
  });

  it("accepts a to-one embed as an array, skips duplicates and rows without a clinic", () => {
    const locations = listingClinicLocations({
      listing_clinics: [
        { is_primary: true, clinics: [nicosia] },
        { is_primary: false, clinics: nicosia },
        { is_primary: false, clinics: null },
      ],
    });
    assert.deepEqual(
      locations.map((loc) => loc.clinicId),
      ["c-nic"],
    );
  });

  it("returns nothing for a row without clinics", () => {
    assert.deepEqual(listingClinicLocations({}), []);
    assert.deepEqual(listingClinicLocations({ listing_clinics: null }), []);
  });
});

describe("pickListingCardClinic", () => {
  const locations = listingClinicLocations(row);

  it("is the primary clinic without filters", () => {
    assert.equal(pickListingCardClinic(locations, {})?.clinicId, "c-nic");
  });

  it("is the clinic in the filtered district, primary or not", () => {
    assert.equal(pickListingCardClinic(locations, { district: "Limassol" })?.clinicId, "c-lim");
    assert.equal(pickListingCardClinic(locations, { district: "nicosia" })?.clinicId, "c-nic");
  });

  it("is the clinic in the filtered town", () => {
    assert.equal(
      pickListingCardClinic(locations, { district: "Nicosia", town: "Strovolos" })?.clinicId,
      "c-nic",
    );
    assert.equal(pickListingCardClinic(locations, { town: "Larnaca" })?.clinicId, "c-lar");
  });

  it("falls back to the primary clinic when no clinic matches the filter", () => {
    assert.equal(pickListingCardClinic(locations, { district: "Paphos" })?.clinicId, "c-nic");
  });

  it("is the nearest clinic with a pin for near-me", () => {
    const nearLimassol = { latitude: 34.69, longitude: 33.0 };
    assert.equal(pickListingCardClinic(locations, { coords: nearLimassol })?.clinicId, "c-lim");
    // Within a district filter, distance only chooses among that district's clinics.
    assert.equal(
      pickListingCardClinic(locations, { district: "Nicosia", coords: nearLimassol })?.clinicId,
      "c-nic",
    );
  });

  it("is null without clinics", () => {
    assert.equal(pickListingCardClinic([], { district: "Nicosia" }), null);
  });
});
