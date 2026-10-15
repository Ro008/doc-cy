import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LISTING_CLINICS_SELECT,
  listingClinicLocations,
} from "@/lib/listing-clinic-location";

// Point E5: a listing's district, town, address, map link and pin come from its
// clinics (`professional_clinics`), never from copies on `professionals`.
const nicosia = {
  id: "c-nic",
  name: "Strovolos Medical Centre",
  slug: "strovolos-medical-centre",
  phone: "22123456",
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
    { sort_order: 1, clinics: limassol },
    { sort_order: 0, clinics: nicosia },
    { sort_order: 1, clinics: { ...larnaca, id: "c-old", is_archived: true } },
    { sort_order: 1, clinics: larnaca },
  ],
};

describe("listingClinicLocations", () => {
  it("selects the clinic fields through professional_clinics", () => {
    assert.equal(
      LISTING_CLINICS_SELECT,
      "listing_clinics:professional_clinics(sort_order, created_at, clinics(id, name, slug, phone, district, town, address, address_maps_link, latitude, longitude, is_archived))",
    );
  });

  it("lists unarchived clinics in the listing's clinic order (no primary clinic)", () => {
    const locations = listingClinicLocations(row);
    assert.deepEqual(
      locations.map((loc) => loc.clinicId),
      ["c-nic", "c-lim", "c-lar"],
    );
    assert.deepEqual(locations[0], {
      clinicId: "c-nic",
      name: "Strovolos Medical Centre",
      slug: "strovolos-medical-centre",
      hasPhone: true,
      district: "Nicosia",
      town: "Strovolos",
      address: "Lemesou Avenue 215, Strovolos, 2029, Nicosia",
      addressMapsLink: "https://www.google.com/maps?q=35.127812,33.37722",
      latitude: 35.127812,
      longitude: 33.37722,
    });
    assert.equal(locations[2]?.latitude, null);
    assert.equal(locations[2]?.addressMapsLink, null);
    assert.equal(locations[2]?.hasPhone, false);
  });

  it("accepts a to-one embed as an array, skips duplicates and rows without a clinic", () => {
    const locations = listingClinicLocations({
      listing_clinics: [
        { sort_order: 0, clinics: [nicosia] },
        { sort_order: 1, clinics: nicosia },
        { sort_order: 1, clinics: null },
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
