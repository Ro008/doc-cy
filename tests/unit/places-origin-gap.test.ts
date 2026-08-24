import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isExpectedVercelPlacesReferrerGap,
  isVercelAppHost,
} from "../prod/helpers/places-origin-gap";

describe("isVercelAppHost", () => {
  it("detects Vercel origin hosts", () => {
    assert.equal(isVercelAppHost("https://doc-cy-git-main-foo.vercel.app"), true);
    assert.equal(isVercelAppHost("https://www.mydoccy.com"), false);
    assert.equal(isVercelAppHost("not a url"), false);
  });
});

describe("isExpectedVercelPlacesReferrerGap", () => {
  it("does not skip when the dropdown appeared", () => {
    assert.equal(
      isExpectedVercelPlacesReferrerGap(
        true,
        { mapsLoaded: true, status: "REQUEST_DENIED", count: 0 },
        true,
      ),
      false,
    );
  });

  it("treats REQUEST_DENIED on vercel.app as the referrer split", () => {
    assert.equal(
      isExpectedVercelPlacesReferrerGap(
        true,
        { mapsLoaded: true, status: "REQUEST_DENIED", count: 0 },
        false,
      ),
      true,
    );
  });

  it("fails quota errors even on vercel.app", () => {
    assert.equal(
      isExpectedVercelPlacesReferrerGap(
        true,
        { mapsLoaded: true, status: "OVER_QUERY_LIMIT", count: 0 },
        false,
      ),
      false,
    );
  });

  it("fails when Places returns predictions but the dropdown is missing", () => {
    assert.equal(
      isExpectedVercelPlacesReferrerGap(
        true,
        { mapsLoaded: true, status: "OK", count: 3 },
        false,
      ),
      false,
    );
  });

  it("still fails REQUEST_DENIED on the canonical domain", () => {
    assert.equal(
      isExpectedVercelPlacesReferrerGap(
        false,
        { mapsLoaded: true, status: "REQUEST_DENIED", count: 0 },
        false,
      ),
      false,
    );
  });

  it("treats Maps JS blocked on vercel.app as the referrer split", () => {
    assert.equal(
      isExpectedVercelPlacesReferrerGap(
        true,
        { mapsLoaded: false, status: "NO_MAPS", count: 0 },
        false,
      ),
      true,
    );
  });

  it("treats empty predictions on vercel.app as the referrer split", () => {
    assert.equal(
      isExpectedVercelPlacesReferrerGap(
        true,
        { mapsLoaded: true, status: "ZERO_RESULTS", count: 0 },
        false,
      ),
      true,
    );
    assert.equal(
      isExpectedVercelPlacesReferrerGap(
        true,
        { mapsLoaded: true, status: "OK", count: 0 },
        false,
      ),
      true,
    );
  });

  it("fails unknown Places errors even on vercel.app", () => {
    assert.equal(
      isExpectedVercelPlacesReferrerGap(
        true,
        { mapsLoaded: true, status: "UNKNOWN_ERROR", count: 0 },
        false,
      ),
      false,
    );
  });
});
