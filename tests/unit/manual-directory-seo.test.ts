import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildManualDirectorySlugCandidates,
  allocateManualDirectorySlug,
} from "../../lib/manual-directory-slug";
import {
  buildManualDirectorySeoDescription,
  buildManualDirectorySeoTitle,
  getManualDirectorySpecialtySeoLabel,
} from "../../lib/manual-directory-seo";

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
