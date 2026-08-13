import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { FINDER_CLINIC_HERO_ILLUSTRATION } from "@/lib/finder-default-avatars";
import {
  FINDER_CLINICS_HERO_SRC,
  FINDER_HERO_PNG_REDIRECTS,
  FINDER_PROFESSIONALS_HERO_SRC,
  LANDING_HERO_DOCTOR_SRC,
} from "@/lib/finder-hero-images";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MAX_HERO_WEBP_BYTES = 180 * 1024;

describe("finder hero images", () => {
  it("uses compressed WebP for LCP heroes", () => {
    assert.equal(FINDER_PROFESSIONALS_HERO_SRC, "/finder/finder-hero.webp");
    assert.equal(FINDER_CLINICS_HERO_SRC, "/finder/clinics-hero.webp");
    assert.equal(LANDING_HERO_DOCTOR_SRC, "/landing/hero-doctor.webp");
    assert.equal(FINDER_CLINIC_HERO_ILLUSTRATION, "/finder/avatars/clinic-hero.webp");
  });

  it("keeps public WebP files small and does not leave the old PNGs in public/", () => {
    for (const redirect of FINDER_HERO_PNG_REDIRECTS) {
      const webpPath = path.join(repoRoot, "public", redirect.destination.replace(/^\//, ""));
      const pngPath = path.join(repoRoot, "public", redirect.source.replace(/^\//, ""));
      assert.equal(fs.existsSync(pngPath), false, `expected ${redirect.source} to be removed`);
      assert.equal(fs.existsSync(webpPath), true, `expected ${redirect.destination} to exist`);
      const size = fs.statSync(webpPath).size;
      assert.ok(
        size > 0 && size <= MAX_HERO_WEBP_BYTES,
        `${redirect.destination} is ${size} bytes; cap is ${MAX_HERO_WEBP_BYTES}`,
      );
    }
  });

  it("redirects legacy PNG hero URLs in next.config", () => {
    const config = fs.readFileSync(path.join(repoRoot, "next.config.mjs"), "utf8");
    for (const redirect of FINDER_HERO_PNG_REDIRECTS) {
      assert.equal(config.includes(`source: "${redirect.source}"`), true);
      assert.equal(config.includes(`destination: "${redirect.destination}"`), true);
    }
  });
});
