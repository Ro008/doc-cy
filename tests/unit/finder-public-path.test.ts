import assert from "node:assert/strict";

import { describe, it } from "node:test";

import {

  finderResultsPath,

  isLegacyFinderFilterPath,

  isPublicFinderResultsPath,

  legacyFinderFilterToPublicPath,

  needsMiddlewareFinderRewrite,

  publicFinderPathToInternal,

} from "@/lib/finder-public-path";



describe("finder public paths", () => {

  it("builds canonical public result URLs", () => {

    assert.equal(finderResultsPath(null, null), "/");

    assert.equal(finderResultsPath("Larnaca", null), "/larnaca");

    assert.equal(finderResultsPath("Larnaca", "Dentistry"), "/larnaca/dentistry");

    assert.equal(finderResultsPath(null, "Gynecology"), "/all/gynecology");

  });



  it("maps legacy /finder filter URLs to public paths", () => {

    assert.equal(isLegacyFinderFilterPath("/finder"), true);

    assert.equal(isLegacyFinderFilterPath("/finder/paphos/dentistry"), true);

    assert.equal(isLegacyFinderFilterPath("/finder/professional/x"), false);

    assert.equal(isLegacyFinderFilterPath("/finder/clinic/y"), false);

    assert.equal(legacyFinderFilterToPublicPath("/finder"), "/");

    assert.equal(legacyFinderFilterToPublicPath("/finder/paphos"), "/paphos");

  });



  it("does not rewrite public finder URLs (real App Router district pages)", () => {

    assert.equal(isPublicFinderResultsPath("/"), true);

    assert.equal(isPublicFinderResultsPath("/larnaca/dentistry"), true);

    assert.equal(isPublicFinderResultsPath("/andreas-nikos"), false);

    assert.equal(needsMiddlewareFinderRewrite("/"), false);

    assert.equal(needsMiddlewareFinderRewrite("/larnaca"), false);

    assert.equal(needsMiddlewareFinderRewrite("/all/gynecology"), false);

    assert.equal(publicFinderPathToInternal("/"), "/finder");

    assert.equal(publicFinderPathToInternal("/larnaca"), "/finder/larnaca");

  });

});


