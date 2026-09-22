import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { clinicRosterPhotoUrl } from "@/lib/clinic-roster-photo";
import { FINDER_DEFAULT_AVATAR_FEMALE, FINDER_DEFAULT_AVATAR_MALE } from "@/lib/finder-default-avatars";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relative: string) => fs.readFileSync(path.join(repoRoot, relative), "utf8");

const storageUrl = (p: string) => `https://cdn.test/storage/v1/object/public/avatars/${p}`;

/**
 * A verified professional uploads a photo at signup; it is stored as a path in
 * `professionals.avatar_url`. The clinic roster never read that column, so anyone
 * verified showed a gender placeholder on the clinic page — and because registration
 * does not ask for gender, "unknown" resolves to the male illustration. A woman who
 * had uploaded her own photo was rendered as a generic man.
 */
describe("clinic roster photo", () => {
  it("prefers the professional's own uploaded avatar", () => {
    const got = clinicRosterPhotoUrl({
      avatarUrl: "profiles/abc/avatar-123.jpg",
      gender: null,
      addressMapsLink: null,
      getStoragePublicUrl: storageUrl,
    });
    assert.equal(got, storageUrl("profiles/abc/avatar-123.jpg"));
  });

  it("passes an absolute avatar through untouched", () => {
    const got = clinicRosterPhotoUrl({
      avatarUrl: "https://example.test/photo.jpg",
      gender: "female",
      addressMapsLink: null,
      getStoragePublicUrl: storageUrl,
    });
    assert.equal(got, "https://example.test/photo.jpg");
  });

  it("falls back to the curated directory photo when there is no upload", () => {
    const curated = "https://cdn.test/curated/maria.webp";
    const got = clinicRosterPhotoUrl({
      avatarUrl: null,
      gender: "female",
      addressMapsLink: null,
      curatedPhotoUrl: curated,
      getStoragePublicUrl: storageUrl,
    });
    assert.equal(got, curated);
  });

  it("falls back to the gender placeholder only when nothing else exists", () => {
    assert.equal(
      clinicRosterPhotoUrl({
        avatarUrl: null,
        gender: "female",
        addressMapsLink: null,
        getStoragePublicUrl: storageUrl,
      }),
      FINDER_DEFAULT_AVATAR_FEMALE,
    );
    assert.equal(
      clinicRosterPhotoUrl({
        avatarUrl: "   ",
        gender: "male",
        addressMapsLink: null,
        getStoragePublicUrl: storageUrl,
      }),
      FINDER_DEFAULT_AVATAR_MALE,
    );
  });

  it("is wired into the clinic page, which must select avatar_url", () => {
    const loader = read("lib/load-clinic-by-slug.ts");
    assert.equal(loader.includes("avatar_url"), true);
    assert.equal(loader.includes("clinicRosterPhotoUrl"), true);
  });
});
