import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLINIC_PIN_FAR_FROM_ADDRESS_METERS,
  CLINIC_PIN_MOVED_THRESHOLD_METERS,
  clinicLocationCoordinates,
  clinicLocationWithCoordinates,
  clinicPinAddressConflicts,
  clinicPinFarFromAddress,
  clinicPinMoved,
  clinicPinStartCoordinates,
  coordinatesNearlyEqual,
  manualClinicLocation,
} from "../../lib/clinic-location-pin";
import { emptyClinicLocation, type ClinicLocation } from "../../lib/clinic-location";
import { registerClinicLocationIsComplete } from "../../lib/register-clinic-location";

const NICOSIA_CENTER = { latitude: 35.1856, longitude: 33.3823 };

function googleResult(): ClinicLocation {
  return {
    address: "Clinic, Limassol, Cyprus",
    latitude: 34.7071,
    longitude: 33.0226,
    placeId: "place-123",
    district: "Limassol",
    town: "Limassol",
  };
}

describe("coordinatesNearlyEqual", () => {
  it("treats sub-metre jitter as the same point", () => {
    assert.equal(
      coordinatesNearlyEqual(
        { latitude: 34.7071, longitude: 33.0226 },
        { latitude: 34.70710000001, longitude: 33.02260000001 },
      ),
      true,
    );
  });

  it("separates points a few metres apart", () => {
    assert.equal(
      coordinatesNearlyEqual(
        { latitude: 34.7071, longitude: 33.0226 },
        { latitude: 34.7072, longitude: 33.0226 },
      ),
      false,
    );
  });

  it("handles missing coordinates", () => {
    assert.equal(coordinatesNearlyEqual(null, null), true);
    assert.equal(coordinatesNearlyEqual(null, NICOSIA_CENTER), false);
  });
});

describe("clinicPinMoved", () => {
  it("ignores a nudge smaller than a building", () => {
    // ~10 m north.
    const origin = { latitude: 34.7071, longitude: 33.0226 };
    const nudged = { latitude: 34.70719, longitude: 33.0226 };
    assert.equal(clinicPinMoved(origin, nudged), false);
  });

  it("reports a real correction", () => {
    // ~110 m north, comfortably past the threshold.
    const origin = { latitude: 34.7071, longitude: 33.0226 };
    const moved = { latitude: 34.7081, longitude: 33.0226 };
    assert.equal(clinicPinMoved(origin, moved), true);
    assert.ok(CLINIC_PIN_MOVED_THRESHOLD_METERS < 110);
  });

  it("is false while either point is unknown", () => {
    assert.equal(clinicPinMoved(null, NICOSIA_CENTER), false);
    assert.equal(clinicPinMoved(NICOSIA_CENTER, null), false);
  });
});

describe("clinicPinAddressConflicts", () => {
  it("flags a pin dragged onto a different street", () => {
    assert.equal(
      clinicPinAddressConflicts(
        "Tombs of the Kings Ave 63, Chlorakas, Pafos 8015, Cyprus",
        "Anania 4, Chlorakas, Pafos 8015, Cyprus",
      ),
      true,
    );
  });

  it("stays quiet for a nudge along the same street", () => {
    // Moving to the right entrance keeps the address the doctor picked correct,
    // and they know their own house number better than reverse geocoding does.
    assert.equal(
      clinicPinAddressConflicts(
        "Tombs of the Kings Ave 63, Chlorakas, Pafos 8015, Cyprus",
        "Tombs of the Kings Ave 61, Chlorakas, Pafos 8015, Cyprus",
      ),
      false,
    );
  });

  it("ignores punctuation and case", () => {
    assert.equal(
      clinicPinAddressConflicts("Agiou Andreou St., Limassol", "Agiou Andreou Street, Limassol"),
      true,
    );
    assert.equal(
      clinicPinAddressConflicts("Agiou Andreou, Limassol", "  agiou   andreou , Limassol"),
      false,
    );
  });

  it("does not warn when there is nothing to compare", () => {
    // Street-less geocoder results (postcode, plus code) are dropped upstream in
    // reverseGeocodeClinicPin, so an empty side means "cannot tell".
    assert.equal(clinicPinAddressConflicts("Dikomou 8, Nicosia", ""), false);
    assert.equal(clinicPinAddressConflicts("", "Anania 4, Pafos"), false);
    assert.equal(clinicPinAddressConflicts("8025, Cyprus", "Anania 4, Pafos"), false);
  });
});

describe("clinicPinFarFromAddress", () => {
  it("ignores a correction inside the same block", () => {
    // ~110 m: past the "moved" threshold, but still plausibly the same address.
    assert.equal(
      clinicPinFarFromAddress(
        { latitude: 34.7071, longitude: 33.0226 },
        { latitude: 34.7081, longitude: 33.0226 },
      ),
      false,
    );
  });

  it("flags a move of a few hundred metres", () => {
    // ~330 m north.
    assert.equal(
      clinicPinFarFromAddress(
        { latitude: 34.7071, longitude: 33.0226 },
        { latitude: 34.7101, longitude: 33.0226 },
      ),
      true,
    );
    assert.ok(CLINIC_PIN_FAR_FROM_ADDRESS_METERS > CLINIC_PIN_MOVED_THRESHOLD_METERS);
  });
});

describe("clinicPinStartCoordinates", () => {
  it("opens on the confirmed pin when there is one", () => {
    const coords = clinicPinStartCoordinates(googleResult(), null);
    assert.deepEqual(coords, { latitude: 34.7071, longitude: 33.0226 });
  });

  it("falls back to the chosen district centre", () => {
    const coords = clinicPinStartCoordinates(emptyClinicLocation(), "Nicosia");
    assert.deepEqual(coords, NICOSIA_CENTER);
  });
});

describe("clinicLocationWithCoordinates", () => {
  it("keeps the address, place id and district when the pin moves", () => {
    const moved = clinicLocationWithCoordinates(googleResult(), {
      latitude: 34.71,
      longitude: 33.03,
    });
    assert.equal(moved.latitude, 34.71);
    assert.equal(moved.longitude, 33.03);
    assert.equal(moved.address, "Clinic, Limassol, Cyprus");
    assert.equal(moved.placeId, "place-123");
    // A pin nudge must not silently reassign the district the finder filters on.
    assert.equal(moved.district, "Limassol");
  });
});

describe("manualClinicLocation", () => {
  it("builds a complete location from district, address and pin", () => {
    const location = manualClinicLocation({
      address: "12 Makariou Avenue, 2nd floor",
      district: "Paphos",
      coords: { latitude: 34.7754, longitude: 32.4245 },
    });
    assert.equal(location.district, "Paphos");
    assert.equal(location.address, "12 Makariou Avenue, 2nd floor");
    assert.equal(location.placeId, null);
    assert.equal(registerClinicLocationIsComplete(location), true);
  });

  it("keeps the doctor's district instead of inferring one from the pin", () => {
    // Pin left on the Nicosia centre while the doctor says Larnaca.
    const location = manualClinicLocation({
      address: "Somewhere",
      district: "Larnaca",
      coords: NICOSIA_CENTER,
    });
    assert.equal(location.district, "Larnaca");
  });

  it("is incomplete until the address is typed", () => {
    const location = manualClinicLocation({
      address: "",
      district: "Nicosia",
      coords: NICOSIA_CENTER,
    });
    assert.equal(registerClinicLocationIsComplete(location), false);
    assert.deepEqual(clinicLocationCoordinates(location), NICOSIA_CENTER);
  });

  it("infers the district from the pin when none was chosen", () => {
    const location = manualClinicLocation({
      address: "Somewhere in Paphos",
      district: null,
      coords: { latitude: 34.7754, longitude: 32.4245 },
    });
    assert.equal(location.district, "Paphos");
  });
});

describe("registerClinicLocationIsComplete", () => {
  it("rejects coordinates without an address", () => {
    assert.equal(
      registerClinicLocationIsComplete({ ...googleResult(), address: "   " }),
      false,
    );
  });

  it("rejects coordinates without a district", () => {
    assert.equal(registerClinicLocationIsComplete({ ...googleResult(), district: null }), false);
  });

  it("rejects an address typed without picking a place", () => {
    assert.equal(
      registerClinicLocationIsComplete({
        ...emptyClinicLocation(),
        address: "My clinic",
      }),
      false,
    );
  });

  it("accepts a confirmed Google pick", () => {
    assert.equal(registerClinicLocationIsComplete(googleResult()), true);
  });
});
