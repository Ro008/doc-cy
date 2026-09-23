import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { registerClaimPath } from "../../lib/claim-directory-professional";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relative: string): string {
  return fs.readFileSync(path.join(repoRoot, relative), "utf8");
}

/** "Claim profile" / "Are you a health professional?" CTAs must land on /register. */
describe("professional CTAs go to /register", () => {
  it("claim-this-profile links stay on /register (with the listing id for prefill)", () => {
    assert.match(
      registerClaimPath("0b6f3a7e-1c2d-4e5f-8a9b-0c1d2e3f4a5b"),
      /^\/register\?claim=/,
    );
  });

  it("finder footer 'Are you a healthcare professional?' links to /register", () => {
    const source = read("app/finder/[[...filters]]/page.tsx");
    const at = source.indexOf("Are you a healthcare professional?");
    assert.ok(at >= 0, "finder footer CTA copy not found");
    const cta = source.slice(at, at + 400);
    assert.match(cta, /href="\/register"/);
    assert.doesNotMatch(cta, /FOR_PROFESSIONALS_PATH|founders-pricing/);
  });

  it("blog 'claim your profile' links to /register", () => {
    const source = read("content/blog/fake-online-booking-illusion-cyprus-clinics.mdx");
    assert.match(source, /\[claim your profile\]\(\/register\)/);
  });
});
