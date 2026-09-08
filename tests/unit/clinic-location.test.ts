import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clinicAddressDistrictConflicts,
  clinicLocationFromParts,
  clinicLocationWithAddressAlignedDistrict,
  hasConfirmedClinicCoordinates,
  inferCyprusDistrictFromClinic,
} from "../../lib/clinic-location";

describe("inferCyprusDistrictFromClinic", () => {
  it("resolves district aliases from free-text address", () => {
    assert.equal(
      inferCyprusDistrictFromClinic({ address: "Clinic in Ayia Napa, Cyprus" }),
      "Famagusta",
    );
    assert.equal(
      inferCyprusDistrictFromClinic({ address: "42 Makariou Ave, Limassol" }),
      "Limassol",
    );
  });

  it("resolves district from Google address components", () => {
    assert.equal(
      inferCyprusDistrictFromClinic({
        addressComponents: [
          { long_name: "Strovolos", short_name: "Strovolos", types: ["locality"] },
        ],
      }),
      "Nicosia",
    );
  });

  it("falls back to nearest district from Cyprus coordinates", () => {
    assert.equal(
      inferCyprusDistrictFromClinic({
        address: "Some street",
        latitude: 34.7071,
        longitude: 33.0226,
      }),
      "Limassol",
    );
  });

  it("returns null when no district signal is available", () => {
    assert.equal(
      inferCyprusDistrictFromClinic({
        address: "Unknown road",
        latitude: 40.4168,
        longitude: -3.7038,
      }),
      null,
    );
  });

  it("prefers the city named in the address over pin coordinates", () => {
    // The pin can sit in Paphos while the address text still says Nicosia —
    // that is exactly the contradictory state we must never store.
    assert.equal(
      inferCyprusDistrictFromClinic({
        address: "Copenhagen, Nicosia 2306",
        latitude: 34.7754,
        longitude: 32.4245,
      }),
      "Nicosia",
    );
  });
});

describe("clinicLocationFromParts", () => {
  it("derives district from coordinates when district is missing", () => {
    const location = clinicLocationFromParts({
      address: "Clinic address",
      latitude: 34.7754,
      longitude: 32.4245,
    });
    assert.equal(location.district, "Paphos");
    assert.equal(location.latitude, 34.7754);
    assert.equal(location.longitude, 32.4245);
  });

  it("keeps an explicit valid district", () => {
    const location = clinicLocationFromParts({
      address: "Clinic address",
      district: "Larnaca",
      latitude: 34.9182,
      longitude: 33.6232,
    });
    assert.equal(location.district, "Larnaca");
    assert.equal(location.town, null);
  });

  it("fills town from clinic address text", () => {
    const location = clinicLocationFromParts({
      address: "1 Clinic Street, Tala, Paphos",
      district: "Paphos",
    });
    assert.equal(location.town, "Tala");
  });

  it("uses address components before falling back to the pin", () => {
    const location = clinicLocationFromParts({
      address: "Some street",
      latitude: 34.7754,
      longitude: 32.4245,
      addressComponents: [
        { long_name: "Nicosia", short_name: "Nicosia", types: ["locality"] },
      ],
    });
    assert.equal(location.district, "Nicosia");
  });
});

describe("clinicAddressDistrictConflicts", () => {
  it("flags a Nicosia address filed under Paphos", () => {
    assert.equal(
      clinicAddressDistrictConflicts({
        address: "Copenhagen, Nicosia 2306",
        latitude: 35.1856,
        longitude: 33.3823,
        placeId: null,
        district: "Paphos",
        town: null,
      }),
      true,
    );
  });

  it("is quiet when they agree", () => {
    assert.equal(
      clinicAddressDistrictConflicts({
        address: "Tombs of the Kings Ave 63, Chlorakas, Pafos 8015, Cyprus",
        latitude: 34.8,
        longitude: 32.4,
        placeId: "x",
        district: "Paphos",
        town: "Chlorakas",
      }),
      false,
    );
  });
});

describe("clinicLocationWithAddressAlignedDistrict", () => {
  it("rewrites Paphos to Nicosia when the address names Nicosia", () => {
    const fixed = clinicLocationWithAddressAlignedDistrict({
      address: "Copenhagen, Nicosia 2306",
      latitude: 34.7754,
      longitude: 32.4245,
      placeId: null,
      district: "Paphos",
      town: null,
    });
    assert.equal(fixed.district, "Nicosia");
  });
});

describe("hasConfirmedClinicCoordinates", () => {
  it("requires in-bounds Cyprus coordinates", () => {
    assert.equal(
      hasConfirmedClinicCoordinates({
        address: "Clinic",
        latitude: 34.7071,
        longitude: 33.0226,
        placeId: null,
        district: "Limassol",
        town: "Limassol",
      }),
      true,
    );
    assert.equal(
      hasConfirmedClinicCoordinates({
        address: "Clinic",
        latitude: 40.4168,
        longitude: -3.7038,
        placeId: null,
        district: null,
        town: null,
      }),
      false,
    );
  });
});
