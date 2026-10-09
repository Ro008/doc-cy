import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMapsUrlFromAddress,
  buildMapsUrlFromClinicLocation,
  clinicMapsUrl,
} from "../../lib/clinic-info";

describe("clinic-info", () => {
  it("does not invent a hardcoded Evangelismos fallback for empty addresses", () => {
    assert.equal(buildMapsUrlFromAddress(""), null);
    assert.equal(buildMapsUrlFromAddress("   "), null);
    assert.equal(
      buildMapsUrlFromClinicLocation({
        address: null,
        latitude: null,
        longitude: null,
        placeId: null,
      }),
      null,
    );
  });

  it("builds maps URLs from a real address", () => {
    const url = buildMapsUrlFromAddress("12 Makariou Avenue, Nicosia");
    assert.ok(url);
    assert.match(url!, /maps\.google\.com/);
    assert.match(url!, /Makariou/);
    assert.doesNotMatch(url!, /Evangelismos/i);
  });

  // Booking emails link the clinic's own pin, `clinics.address_maps_link` (user, 2026-10-05).
  it("clinicMapsUrl prefers the clinic's stored Maps link", () => {
    assert.equal(
      clinicMapsUrl({
        mapsLink: " https://www.google.com/maps?q=35.110358,33.308237 ",
        latitude: 1,
        longitude: 2,
        address: "Spyridonos Trikoupi 21, Lakatameia",
      }),
      "https://www.google.com/maps?q=35.110358,33.308237",
    );
  });

  it("clinicMapsUrl falls back to the coordinates, then the address", () => {
    assert.equal(
      clinicMapsUrl({ mapsLink: "", latitude: 35.11, longitude: 33.3, address: "1 Ledra Street" }),
      "https://www.google.com/maps?q=35.11,33.3",
    );
    assert.match(clinicMapsUrl({ address: "1 Ledra Street, Nicosia" }) ?? "", /maps\.google\.com\/\?q=1%20Ledra/);
    assert.equal(clinicMapsUrl({ address: " " }), null);
  });

  it("clinicMapsUrl ignores a stored link that isn't https", () => {
    assert.equal(
      clinicMapsUrl({ mapsLink: "javascript:alert(1)", latitude: 35.11, longitude: 33.3 }),
      "https://www.google.com/maps?q=35.11,33.3",
    );
  });
});
