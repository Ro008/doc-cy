import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  parseDefaultScheme,
  readSchemeCookie,
  resolveSiteScheme,
} from "../../lib/profile-scheme";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

describe("one Light / Dark choice for the whole public site (user, 2026-10-13)", () => {
  it("reads only an exact light or dark from the cookie", () => {
    assert.equal(readSchemeCookie("dark"), "dark");
    assert.equal(readSchemeCookie(" Light "), "light");
    assert.equal(readSchemeCookie(undefined), null);
    assert.equal(readSchemeCookie(""), null);
    assert.equal(readSchemeCookie("auto"), null);
    assert.equal(readSchemeCookie("dark; injected"), null);
  });

  it("the visitor's own choice wins; without one, the founders' default", () => {
    assert.equal(resolveSiteScheme("dark", "light"), "dark");
    assert.equal(resolveSiteScheme("light", "dark"), "light");
    assert.equal(resolveSiteScheme(undefined, "dark"), "dark");
    assert.equal(resolveSiteScheme("nonsense", "light"), "light");
  });

  it("reads the default from app_settings, light when missing or invalid", () => {
    assert.equal(parseDefaultScheme("dark"), "dark");
    assert.equal(parseDefaultScheme("light"), "light");
    assert.equal(parseDefaultScheme(null), null);
    assert.equal(parseDefaultScheme(undefined), null);
    assert.equal(parseDefaultScheme("Dark"), null);
    assert.equal(parseDefaultScheme(1), null);
    assert.equal(parseDefaultScheme({ scheme: "dark" }), null);
  });
});

describe("the default lives in app_settings.public_default_scheme", () => {
  const setting = read("lib/site-default-scheme.ts");

  it("is read through the service role and cached for 5 minutes, light if it cannot be read", () => {
    assert.match(setting, /PUBLIC_DEFAULT_SCHEME_KEY = "public_default_scheme"/);
    assert.match(setting, /unstable_cache\(/);
    assert.match(setting, /revalidate: 300/);
    assert.match(setting, /tags: \[PUBLIC_DEFAULT_SCHEME_TAG\]/);
    assert.match(setting, /\?\? "light"/);
    assert.match(setting, /readSchemeCookie\(cookies\(\)\.get\(PROFILE_SCHEME_COOKIE\)\?\.value\)/);
  });

  it("only founders change it; saving clears the cache at once", () => {
    const route = read("app/api/internal/settings/public-default-scheme/route.ts");
    assert.match(route, /requireAdminWrite\(\)/);
    assert.match(route, /requireAdmin\(\)/);
    assert.match(route, /revalidateTag\(PUBLIC_DEFAULT_SCHEME_TAG\)/);
    const dashboard = read("app/internal/directory/page.tsx");
    assert.match(dashboard, /<PublicDefaultSchemeSetting\b/);
  });

  it("the migration adds the row as light, with a check that allows only light or dark", () => {
    const dir = path.join(repoRoot, "supabase/migrations");
    const file = fs.readdirSync(dir).find((name) => name.endsWith("_app_settings_public_default_scheme.sql"));
    assert.ok(file, "migration file");
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    assert.match(sql, /app_settings_public_default_scheme_valid/);
    assert.match(sql, /'public_default_scheme',\s*'"light"'/);
    assert.match(sql, /on conflict \(key\) do nothing/);
  });
});

describe("every public page paints the right mode from the first byte", () => {
  it("Finder (home and district pages too), Clinics and loading screens sit in one themed root", () => {
    for (const file of ["app/finder/[[...filters]]/page.tsx", "app/clinics/[[...filters]]/page.tsx"]) {
      // The fallback is the synchronous view: an async fallback left the page unhydrated.
      assert.match(
        read(file),
        /<SiteSchemeRoot>\s*<Suspense\s+fallback=\{\s*<FinderSearchRouteLoadingView proSessionHint=\{readProSessionHint\(\)\} scheme=\{scheme\} \/>/,
        file,
      );
      assert.doesNotMatch(read(file), /fallback=\{<FinderSearchRouteLoading \/>\}/, file);
    }
    assert.doesNotMatch(
      read("components/finder/FinderSearchRouteLoading.tsx"),
      /async function FinderSearchRouteLoadingView/,
    );
    assert.match(read("app/page.tsx"), /return FinderPage\(/);
    assert.match(read("lib/finder-district-route.ts"), /return FinderPage\(/);
    assert.match(read("components/finder/FinderSearchRouteLoading.tsx"), /<SiteSchemeRoot>/);
    const rootFile = read("components/site/SiteSchemeRoot.tsx");
    assert.match(rootFile, /await getSiteScheme\(\)/);
    assert.match(rootFile, /className="doccy-profile/);
    assert.match(rootFile, /data-scheme=\{scheme\}/);
    assert.match(rootFile, /style=\{profileThemeStyle\(\)\}/);
  });

  it("the public profile uses the same choice and default", () => {
    const page = read("lib/public/doctor-profile-page.tsx");
    assert.match(page, /\bscheme,\s*\] = await Promise\.all\(\[[\s\S]*?getSiteScheme\(\),\s*\]\)/);
    assert.doesNotMatch(page, /parseProfileScheme\(cookies\(\)/);
  });
});

describe("the public header carries the Light / Dark switch", () => {
  const header = read("components/finder/FinderPublicHeader.tsx");

  it("shows the switch when the page has a light and a dark look", () => {
    assert.match(header, /scheme\?: ProfileScheme/);
    assert.match(header, /<SiteSchemeToggle\b/);
    // One switch per page: the profile's own one in the page body is gone.
    const page = read("lib/public/doctor-profile-page.tsx");
    assert.doesNotMatch(page, /<ProfileSchemeToggle\b/);
    assert.match(page, /<FinderPublicHeader[^>]*scheme=\{scheme\}/);
    for (const file of ["app/finder/[[...filters]]/page.tsx", "app/clinics/[[...filters]]/page.tsx"]) {
      assert.match(read(file), /<FinderPublicHeader[^>]*scheme=\{scheme\}/, file);
    }
  });

  it("says For professionals and Professional login side by side (canvas comment)", () => {
    assert.match(header, />\s*For professionals\s*</);
    assert.match(header, />\s*Professional login\s*</);
    assert.match(header, /href="\/for-professionals"/);
  });

  it("the switch flips every themed root on the page and remembers the choice", () => {
    const toggle = read("components/site/SiteSchemeToggle.tsx");
    assert.match(toggle, /querySelectorAll<HTMLElement>\("\.doccy-profile"\)/);
    assert.match(toggle, /profileSchemeCookie\(/);
    assert.match(toggle, /aria-pressed/);
    // On a phone it is one small button that flips the mode (no room for two).
    assert.match(toggle, /md:hidden/);
  });
});

describe("the GeSY mark has a white-text copy for dark pages", () => {
  it("shows the transparent logo in light and its white-text copy in dark, English and Greek", () => {
    const badge = read("components/brand/GesyProviderBadge.tsx");
    assert.match(badge, /\/brand\/gesy-logo-en-on-dark\.png/);
    assert.match(badge, /\/brand\/gesy-logo-el-on-dark\.png/);
    assert.match(badge, /\[\.doccy-profile\[data-scheme=dark\]_&\]:hidden/);
    for (const file of ["gesy-logo-en-on-dark.png", "gesy-logo-el-on-dark.png"]) {
      assert.ok(fs.existsSync(path.join(repoRoot, "public/brand", file)), file);
    }
  });
});
