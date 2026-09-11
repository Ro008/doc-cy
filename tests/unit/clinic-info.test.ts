import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMapsUrlFromAddress,
  buildMapsUrlFromClinicLocation,
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
});
