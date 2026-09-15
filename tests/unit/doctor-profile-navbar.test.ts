import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("doctor profile page navbar", () => {
  it("renders the same public header (with practitioner login CTAs) as the finder", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "lib/public/doctor-profile-page.tsx"),
      "utf8",
    );

    // Same component the finder / clinics / for-professionals pages use, so a
    // doctor (or prospective doctor) can log in or register straight from a
    // public profile URL, not just from the finder.
    assert.equal(
      source.includes('import { FinderPublicHeader } from "@/components/finder/FinderPublicHeader";'),
      true,
    );
    assert.equal(/<FinderPublicHeader\s+proSessionHint=\{proSessionHint\}\s*\/>/.test(source), true);

    // Server-read pro-session hint (same pattern as app/finder/[[...filters]]/page.tsx)
    // so signed-in doctors never flash the guest CTAs.
    assert.equal(
      source.includes(
        'import { isProSessionHintValue, PRO_SESSION_HINT_COOKIE } from "@/lib/pro-session-hint";',
      ),
      true,
    );
    assert.equal(source.includes("isProSessionHintValue("), true);
    assert.equal(source.includes("PRO_SESSION_HINT_COOKIE"), true);

    // The page no longer paints its own duplicate wordmark/home-link row now
    // that FinderPublicHeader already renders the logo + guest nav.
    assert.equal(source.includes("DocCyWordmark"), false);

    // Directory-only (unregistered) profiles share the same public URL shape
    // (`/{locale}/{slug}`) and must keep the same guest login/register CTAs.
    assert.match(
      source,
      /<ManualDirectoryProfessionalLanding[\s\S]*proSessionHint=\{proSessionHint\}/,
    );
  });

  it("renders the same public header on unregistered directory landings", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "components/finder/ManualDirectoryProfessionalLanding.tsx"),
      "utf8",
    );

    assert.equal(
      source.includes(
        'import { FinderPublicHeader } from "@/components/finder/FinderPublicHeader";',
      ),
      true,
    );
    assert.equal(/<FinderPublicHeader\s+proSessionHint=\{proSessionHint\}\s*\/>/.test(source), true);
    assert.equal(source.includes("DocCyWordmark"), false);
  });
});

describe("clinic landing page navbar", () => {
  it("renders the same public header (with practitioner login CTAs) as the finder", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "components/finder/ClinicLandingView.tsx"),
      "utf8",
    );

    assert.equal(
      source.includes(
        'import { FinderPublicHeader } from "@/components/finder/FinderPublicHeader";',
      ),
      true,
    );
    assert.equal(/<FinderPublicHeader\s+proSessionHint=\{proSessionHint\}\s*\/>/.test(source), true);
    assert.equal(source.includes("DocCyWordmark"), false);

    const clinicsPage = fs.readFileSync(
      path.join(repoRoot, "app/clinics/[[...filters]]/page.tsx"),
      "utf8",
    );
    assert.match(
      clinicsPage,
      /<ClinicLandingView[\s\S]*proSessionHint=\{isProSessionHintValue\(/,
    );
  });
});
