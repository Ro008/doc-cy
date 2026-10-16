import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { DIRECTORY_CANARIES } from "../../lib/directory-canaries";
import { publicClinicSitemapPaths } from "../../lib/sitemap-clinics";

/**
 * Clinic pages stay public and Google should index them (user, 2026-10-16), even though the
 * Finder no longer searches clinics: the sitemap lists `/clinics` and every clinic page.
 */

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const canary = DIRECTORY_CANARIES[0];

describe("publicClinicSitemapPaths", () => {
  it("lists every live clinic page by its current slug, sorted and once each", () => {
    assert.deepEqual(
      publicClinicSitemapPaths([
        { id: "c-2", slug: "paphos-heart-centre", is_archived: false },
        { id: "c-1", slug: " limassol-family-clinic ", is_archived: false },
        { id: "c-3", slug: "paphos-heart-centre", is_archived: false },
      ]),
      ["/clinics/limassol-family-clinic", "/clinics/paphos-heart-centre"],
    );
  });

  it("skips archived clinics and clinics without a slug", () => {
    assert.deepEqual(
      publicClinicSitemapPaths([
        { id: "c-1", slug: "closed-clinic", is_archived: true },
        { id: "c-2", slug: null, is_archived: false },
        { id: "c-3", slug: "  ", is_archived: false },
        { id: "c-4", slug: "open-clinic", is_archived: false },
      ]),
      ["/clinics/open-clinic"],
    );
  });

  it("skips the directory canary clinics, by id or by slug", () => {
    assert.deepEqual(
      publicClinicSitemapPaths([
        { id: canary.clinicId, slug: "renamed-canary", is_archived: false },
        { id: "c-9", slug: canary.clinicSlug, is_archived: false },
        { id: "c-1", slug: "real-clinic", is_archived: false },
      ]),
      ["/clinics/real-clinic"],
    );
  });

  it("skips slugs the clinic page cannot open: a district search, \"all\", or capitals", () => {
    assert.deepEqual(
      publicClinicSitemapPaths([
        { id: "c-1", slug: "paphos", is_archived: false },
        { id: "c-2", slug: "all", is_archived: false },
        { id: "c-3", slug: "Mixed-Case-Clinic", is_archived: false },
        { id: "c-4", slug: "nicosia-eye-clinic", is_archived: false },
      ]),
      ["/clinics/nicosia-eye-clinic"],
    );
  });
});

describe("the sitemap", () => {
  const sitemap = read("app/sitemap.ts");

  it("lists /clinics and the clinic pages", () => {
    assert.match(sitemap, /\$\{siteBase\}\/clinics`/);
    assert.match(sitemap, /loadPublicClinicSitemapPaths\(supabase\)/);
    assert.match(sitemap, /\.\.\.clinicEntries/);
  });

  it("reads clinics through the service role in pages, never the old slugs", () => {
    const loader = read("lib/sitemap-clinics.ts");
    assert.match(loader, /fetchAllSupabaseRows(<\w+>)?\(/);
    assert.match(loader, /\.from\("clinics"\)/);
    assert.match(loader, /\.eq\("is_archived", false\)/);
    assert.doesNotMatch(loader, /clinic_slug_redirects/);
  });
});
