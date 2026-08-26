import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveCanonicalManualDirectorySlug } from "../../lib/load-manual-directory-by-slug";
import {
  buildManualDirectorySlugCandidates,
  allocateManualDirectorySlug,
  pickUniqueLegacyNameSlugAlias,
} from "../../lib/manual-directory-slug";
import {
  buildManualDirectorySeoDescription,
  buildManualDirectorySeoTitle,
  getManualDirectorySpecialtySeoLabel,
} from "../../lib/manual-directory-seo";

type AliasRow = {
  slug: string;
  name: string;
  finder_visible?: boolean;
};

function mockManualDirectorySlugClient(opts: {
  exactSlug?: string | null;
  aliasRows?: AliasRow[];
}): SupabaseClient {
  const exactSlug = opts.exactSlug ?? null;
  const aliasRows = opts.aliasRows ?? [];

  const client = {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: unknown) {
              return this;
            },
            like(_col: string, _pattern: string) {
              return this;
            },
            async maybeSingle() {
              if (!exactSlug) return { data: null, error: null };
              return { data: { slug: exactSlug }, error: null };
            },
            async range(_from: number, _to: number) {
              return { data: aliasRows, error: null };
            },
          };
        },
      };
    },
  };

  return client as unknown as SupabaseClient;
}

describe("manual-directory-slug", () => {
  it("builds district suffix before numeric suffixes", () => {
    const candidates = buildManualDirectorySlugCandidates({
      name: "Savvas Themistocleous",
      district: "Paphos",
      manualId: "2f9854a2-63bf-4b20-a1dd-96b524b22c0b",
    });

    assert.deepEqual(candidates.slice(0, 3), [
      "savvas-themistocleous",
      "savvas-themistocleous-paphos",
      "savvas-themistocleous-2",
    ]);
  });

  it("avoids collisions with registered doctor slugs", () => {
    const taken = new Set(["savvas-themistocleous"]);
    assert.equal(
      allocateManualDirectorySlug(taken, {
        name: "Savvas Themistocleous",
        district: "Paphos",
      }),
      "savvas-themistocleous-paphos",
    );
  });

  it("redirects a retired name-only slug only when the person is unique", () => {
    assert.equal(
      pickUniqueLegacyNameSlugAlias("vera-politou", [
        { slug: "vera-politou-paphos", name: "Vera Politou", finder_visible: true },
      ]),
      "vera-politou-paphos",
    );
  });

  it("does not collapse two people with the same name onto one URL", () => {
    assert.equal(
      pickUniqueLegacyNameSlugAlias("vera-politou", [
        { slug: "vera-politou-paphos", name: "Vera Politou", finder_visible: true },
        { slug: "vera-politou-nicosia", name: "Vera Politou", finder_visible: true },
      ]),
      null,
    );
  });

  it("does not treat a longer different name as the same professional", () => {
    assert.equal(
      pickUniqueLegacyNameSlugAlias("maria", [
        { slug: "maria-papadopoulos-nicosia", name: "Maria Papadopoulos", finder_visible: true },
      ]),
      null,
    );
  });

  it("does not redirect when a same-name hidden listing makes the target ambiguous", () => {
    assert.equal(
      pickUniqueLegacyNameSlugAlias("vera-politou", [
        { slug: "vera-politou-paphos", name: "Vera Politou", finder_visible: false },
        { slug: "vera-politou-limassol", name: "Vera Politou", finder_visible: true },
      ]),
      null,
    );
  });

  it("does not redirect a unique name that is hidden from the finder", () => {
    assert.equal(
      pickUniqueLegacyNameSlugAlias("vera-politou", [
        { slug: "vera-politou-paphos", name: "Vera Politou", finder_visible: false },
      ]),
      null,
    );
  });
});

describe("resolveCanonicalManualDirectorySlug", () => {
  it("returns the exact slug when it still exists", async () => {
    const supabase = mockManualDirectorySlugClient({
      exactSlug: "vera-politou-paphos",
      aliasRows: [],
    });
    assert.equal(
      await resolveCanonicalManualDirectorySlug(supabase, "vera-politou-paphos"),
      "vera-politou-paphos",
    );
  });

  it("maps a unique retired name-only slug to the current district slug", async () => {
    const supabase = mockManualDirectorySlugClient({
      exactSlug: null,
      aliasRows: [
        {
          slug: "vera-politou-paphos",
          name: "Vera Politou",
          finder_visible: true,
        },
      ],
    });
    assert.equal(
      await resolveCanonicalManualDirectorySlug(supabase, "vera-politou"),
      "vera-politou-paphos",
    );
  });

  it("does not invent a redirect when two people share the same name", async () => {
    const supabase = mockManualDirectorySlugClient({
      exactSlug: null,
      aliasRows: [
        { slug: "vera-politou-paphos", name: "Vera Politou", finder_visible: true },
        { slug: "vera-politou-nicosia", name: "Vera Politou", finder_visible: true },
      ],
    });
    assert.equal(await resolveCanonicalManualDirectorySlug(supabase, "vera-politou"), null);
  });

  it("rejects PostgREST LIKE wildcards in the requested slug", async () => {
    const supabase = mockManualDirectorySlugClient({
      exactSlug: null,
      aliasRows: [
        { slug: "vera-politou-paphos", name: "Vera Politou", finder_visible: true },
      ],
    });
    assert.equal(await resolveCanonicalManualDirectorySlug(supabase, "vera_politou"), null);
    assert.equal(await resolveCanonicalManualDirectorySlug(supabase, "vera%politou"), null);
  });

  it("returns null for an empty slug", async () => {
    const supabase = mockManualDirectorySlugClient({ exactSlug: null, aliasRows: [] });
    assert.equal(await resolveCanonicalManualDirectorySlug(supabase, "   "), null);
  });
});

describe("manual-directory-seo", () => {
  it("uses shorter physiotherapy label in titles", () => {
    assert.equal(
      getManualDirectorySpecialtySeoLabel("Physiotherapy & Rehabilitation"),
      "Physiotherapy",
    );
    assert.equal(
      buildManualDirectorySeoTitle({
        name: "Savvas Themistocleous",
        specialty: "Physiotherapy & Rehabilitation",
        district: "Paphos",
      }),
      "Savvas Themistocleous — Physiotherapy in Paphos | DocCy",
    );
  });

  it("does not expose contact details in meta descriptions", () => {
    const description = buildManualDirectorySeoDescription({
      name: "Savvas Themistocleous",
      specialty: "Physiotherapy & Rehabilitation",
      district: "Paphos",
    });
    assert.match(description, /request an appointment/i);
    assert.doesNotMatch(description, /book online instantly/i);
    assert.doesNotMatch(description, /99 999840/);
    assert.doesNotMatch(description, /view contact details/i);
  });
});
