import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MANUAL_DIRECTORY_LANDING_BASE_PATH,
  legacyManualDirectoryLandingToPublicPath,
  manualDirectoryLandingPath,
  publicProfessionalProfilePath,
} from "@/lib/manual-directory-landing-path";

describe("public professional profile path", () => {
  it("uses the default locale prefix for the canonical URL", () => {
    assert.equal(publicProfessionalProfilePath("maria-pap"), "/en/maria-pap");
    assert.equal(manualDirectoryLandingPath("maria-pap"), "/en/maria-pap");
    assert.equal(publicProfessionalProfilePath("maria-pap", "el"), "/el/maria-pap");
  });

  it("maps legacy /finder/professional landings to the canonical URL", () => {
    assert.equal(MANUAL_DIRECTORY_LANDING_BASE_PATH, "/finder/professional");
    assert.equal(
      legacyManualDirectoryLandingToPublicPath("/finder/professional/maria-pap"),
      "/en/maria-pap",
    );
    assert.equal(
      legacyManualDirectoryLandingToPublicPath("/finder/professional/maria-pap", "el"),
      "/el/maria-pap",
    );
    assert.equal(legacyManualDirectoryLandingToPublicPath("/finder/paphos"), null);
  });
});
