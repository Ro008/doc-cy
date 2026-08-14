import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeFinderDistanceKm,
  fallbackDistrictCoordinates,
  formatApproxDistanceAway,
  formatDistanceAway,
  getDistanceKm,
  isApproximateNearMeAccuracy,
  isLikelyCyprusCoordinates,
  parseFinderNearMeQuery,
  parseOptionalCoordinates,
} from "../../lib/finder-distance";

describe("parseOptionalCoordinates", () => {
  it("accepts valid Cyprus coordinates", () => {
    assert.deepEqual(parseOptionalCoordinates(34.7071, 33.0226), {
      latitude: 34.7071,
      longitude: 33.0226,
    });
  });

  it("rejects placeholder 0,0", () => {
    assert.equal(parseOptionalCoordinates(0, 0), null);
  });

  it("rejects invalid latitude", () => {
    assert.equal(parseOptionalCoordinates(120, 33), null);
  });

  it("rejects NaN values", () => {
    assert.equal(parseOptionalCoordinates(Number.NaN, 33), null);
  });
});

describe("isLikelyCyprusCoordinates", () => {
  it("returns true inside Cyprus bounds", () => {
    assert.equal(
      isLikelyCyprusCoordinates({ latitude: 35.1856, longitude: 33.3823 }),
      true,
    );
  });

  it("returns false outside Cyprus bounds", () => {
    assert.equal(
      isLikelyCyprusCoordinates({ latitude: 40.4168, longitude: -3.7038 }),
      false,
    );
  });
});

describe("parseFinderNearMeQuery", () => {
  it("reads GPS coords and accuracy from the finder query", () => {
    const parsed = parseFinderNearMeQuery({
      lat: "34.8",
      lon: "32.45",
      acc: "2500",
    });
    assert.deepEqual(parsed?.coords, { latitude: 34.8, longitude: 32.45 });
    assert.equal(parsed?.accuracyMeters, 2500);
    assert.equal(isApproximateNearMeAccuracy(parsed?.accuracyMeters), true);
    assert.equal(isApproximateNearMeAccuracy(80), false);
    assert.equal(parseFinderNearMeQuery({ lat: "", lon: "" }), null);
  });
});

describe("formatDistanceAway", () => {
  it("formats sub-kilometre distances in metres", () => {
    assert.equal(formatDistanceAway(0.4), "📍 400m away");
  });

  it("formats kilometre distances with one decimal", () => {
    assert.equal(formatDistanceAway(2.34), "📍 2.3 km away");
  });
});

describe("formatApproxDistanceAway", () => {
  it("labels approximate sub-kilometre distances", () => {
    assert.equal(formatApproxDistanceAway(0.4), "📍 ~400m away (approx.)");
  });

  it("labels approximate kilometre distances", () => {
    assert.equal(formatApproxDistanceAway(12.48), "📍 ~12.5 km away (approx.)");
  });
});

describe("getDistanceKm", () => {
  it("returns zero for identical coordinates", () => {
    const point = { latitude: 34.7071, longitude: 33.0226 };
    assert.equal(getDistanceKm(point, point), 0);
  });
});

describe("computeFinderDistanceKm", () => {
  const userInPaphos = { latitude: 34.7754, longitude: 32.4245 };

  it("returns null when the user has no coordinates", () => {
    assert.equal(computeFinderDistanceKm(null, 34.789, 32.44), null);
  });

  it("returns a distance for real Cyprus listing coordinates", () => {
    const km = computeFinderDistanceKm(userInPaphos, 34.7894721, 32.4403038);
    assert.equal(typeof km, "number");
    assert.ok(km !== null && km > 0 && km < 5);
  });

  it("does not invent distance from a district centre when lat/lon are missing", () => {
    // Regression guard: GeSY imports without Places must not show "~X km away (approx.)".
    assert.equal(computeFinderDistanceKm(userInPaphos, null, null), null);
    assert.equal(computeFinderDistanceKm(userInPaphos, undefined, undefined), null);
  });

  it("does not use district-centre fallback helpers for public distance labels", () => {
    const centre = fallbackDistrictCoordinates("Paphos");
    // Helper still exists for non-UI uses, but public distance must ignore it when
    // the listing itself has no coordinates.
    assert.deepEqual(centre, { latitude: 34.7754, longitude: 32.4245 });
    assert.equal(computeFinderDistanceKm(userInPaphos, null, null), null);
  });

  it("returns null for coordinates outside Cyprus", () => {
    assert.equal(computeFinderDistanceKm(userInPaphos, 40.4168, -3.7038), null);
  });
});
