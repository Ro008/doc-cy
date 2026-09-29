import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { googleMapsScriptUrl } from "../../lib/google-maps-loader";

describe("googleMapsScriptUrl", () => {
  it("loads Places in English, biased to Cyprus, whatever the browser language", () => {
    const url = new URL(googleMapsScriptUrl("key with space"));
    assert.equal(url.origin + url.pathname, "https://maps.googleapis.com/maps/api/js");
    assert.equal(url.searchParams.get("key"), "key with space");
    assert.equal(url.searchParams.get("libraries"), "places");
    // Saved clinic addresses must read "Nicosia, Cyprus", not "Lefkosia, Chipre".
    assert.equal(url.searchParams.get("language"), "en");
    assert.equal(url.searchParams.get("region"), "CY");
  });
});
