import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatApproxDistanceAway,
  formatDistanceAway,
  getDistanceKm,
  isLikelyCyprusCoordinates,
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
