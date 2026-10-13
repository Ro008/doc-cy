import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  PROFILE_SHARE_CARD_SIZE,
  isValidShareCardSlug,
  profileShareCardPath,
  profileShareCardVersion,
  shareCardSpecialtyLine,
} from "../../lib/public/profile-share-card";

/**
 * The picture under a shared profile link (user, 2026-10-13): photo, name, specialties, place,
 * the note when there are 3+ reviews, in the professional's own colour. It is generated once per
 * version of those facts: the link carries a `v` that changes when any of them changes, the
 * route only draws when `v` is the current one (anything else is a cheap redirect), and the
 * result is cached for a year. So a crawler can never make the server draw twice.
 */

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

const base = {
  name: "Harrison Ford",
  avatarPath: "profiles/abc/avatar-1.jpg",
  accent: "teal",
  specialties: ["Dentist", "Biochemistry"],
  district: "Nicosia",
  rating: { count: 3, average: 3.6 },
};

describe("profileShareCardVersion", () => {
  it("is short, stable and the same for the same facts", () => {
    const v = profileShareCardVersion(base);
    assert.match(v, /^[0-9a-f]{10}$/);
    assert.equal(profileShareCardVersion({ ...base }), v);
  });

  it("changes whenever something drawn on the card changes", () => {
    const v = profileShareCardVersion(base);
    const changed = [
      { ...base, name: "Harrison Ford Jr" },
      { ...base, avatarPath: "profiles/abc/avatar-2.jpg" },
      { ...base, accent: "violet" },
      { ...base, specialties: ["Dentist"] },
      { ...base, district: "Paphos" },
      { ...base, rating: { count: 4, average: 3.6 } },
      { ...base, rating: { count: 3, average: 3.7 } },
      { ...base, rating: null },
    ].map(profileShareCardVersion);
    for (const other of changed) assert.notEqual(other, v);
    assert.equal(new Set(changed).size, changed.length);
  });

  it("treats a missing photo and district as part of the facts, not as a crash", () => {
    assert.match(profileShareCardVersion({ ...base, avatarPath: null, district: null }), /^[0-9a-f]{10}$/);
  });
});

describe("shareCardSpecialtyLine", () => {
  it("joins up to three with a dot and counts the rest", () => {
    assert.equal(shareCardSpecialtyLine(["Dentist"]), "Dentist");
    assert.equal(shareCardSpecialtyLine(["Dentist", "Biochemistry", "Cardiology"]), "Dentist · Biochemistry · Cardiology");
    assert.equal(
      shareCardSpecialtyLine(["A", "B", "C", "D", "E"]),
      "A · B · C · +2",
    );
  });

  it("is empty with none and ignores blanks", () => {
    assert.equal(shareCardSpecialtyLine([]), "");
    assert.equal(shareCardSpecialtyLine(["  ", "Dentist", ""]), "Dentist");
  });
});

describe("profileShareCardPath and slugs", () => {
  it("builds the image address under /api (Cloudflare leaves it alone) with the version", () => {
    assert.equal(profileShareCardPath("harrison-ford", "0123456789"), "/api/og/profile/harrison-ford?v=0123456789");
  });

  it("only accepts plain slugs", () => {
    assert.equal(isValidShareCardSlug("harrison-ford"), true);
    assert.equal(isValidShareCardSlug("eleni-georgiou-2"), true);
    for (const bad of ["", "A B", "../etc", "x".repeat(121), "dr.smith", "slug/other"]) {
      assert.equal(isValidShareCardSlug(bad), false, bad);
    }
  });

  it("is the usual social card size", () => {
    assert.deepEqual(PROFILE_SHARE_CARD_SIZE, { width: 1200, height: 630 });
  });
});

describe("the image route", () => {
  const route = read("app/api/og/profile/[slug]/route.tsx");

  it("only draws for the current version; anything else is a redirect, an unknown slug a 404", () => {
    assert.match(route, /isValidShareCardSlug\(/);
    assert.match(route, /status:\s*404/);
    assert.match(route, /profileShareCardVersion\(/);
    assert.match(route, /Response\.redirect\(|NextResponse\.redirect\(/);
    const redirect = route.search(/Response\.redirect\(/);
    const draw = route.indexOf("new ImageResponse(");
    assert.ok(redirect > 0 && draw > redirect, "redirect is decided before anything is drawn");
  });

  it("is cached for a year per version, and the redirect only briefly", () => {
    assert.match(route, /max-age=31536000/);
    assert.match(route, /immutable/);
    assert.match(route, /max-age=300|max-age=600/);
  });

  it("draws 1200x630 with the star as a shape (the font has no ★) and a letter tile without a photo", () => {
    assert.match(route, /PROFILE_SHARE_CARD_SIZE/);
    assert.match(route, /<svg\b/);
    assert.doesNotMatch(route, /★/);
    assert.match(route, /initials|getInitials/i);
  });

  it("reads the photo safely: any format becomes a small JPEG, with a timeout and a size cap", () => {
    assert.match(route, /from "sharp"|import\("sharp"\)/);
    assert.match(route, /AbortSignal\.timeout\(/);
    assert.match(route, /MAX_AVATAR_BYTES/);
    assert.match(route, /\.jpeg\(/);
  });

  it("draws with Inter, regular and bold, in Latin and Greek, read from the repo's own files", () => {
    const dir = "assets/fonts/inter";
    for (const file of [
      "inter-latin-400-normal.woff",
      "inter-latin-700-normal.woff",
      "inter-greek-400-normal.woff",
      "inter-greek-700-normal.woff",
    ]) {
      const bytes = fs.readFileSync(path.join(repoRoot, dir, file));
      assert.equal(bytes.subarray(0, 4).toString("latin1"), "wOFF", `${file} is a WOFF font`);
      assert.ok(bytes.length > 5_000 && bytes.length < 100_000, `${file} is a subset, not the whole family`);
      assert.match(route, new RegExp(file.replace(/\./g, "\\.")));
    }
    assert.match(fs.readFileSync(path.join(repoRoot, dir, "LICENSE.txt"), "utf8"), /SIL Open Font License/);
    assert.match(route, /weight: 700/);
    // Greek is a second family after Inter: a same-name Greek font would draw the name without bold.
    assert.match(route, /name: "InterGreek"/);
    assert.match(route, /FONT_FAMILY = "Inter, InterGreek"/);
    assert.match(route, /fontFamily: FONT_FAMILY/);
    assert.match(route, /weight: 400/);
    assert.match(route, /readFile\(/);
    assert.match(route, /process\.cwd\(\)/);
    assert.match(route, /fonts[,:]/);
    // The function bundle must carry the fonts (they are read at run time, not imported).
    assert.match(read("next.config.mjs"), /outputFileTracingIncludes[\s\S]*assets\/fonts\/inter/);
  });

  it("reads published data only: no email, nothing written", () => {
    const loader = read("lib/public/load-profile-share-card.ts");
    for (const source of [route, loader]) {
      assert.doesNotMatch(source, /reviewer_email|patient_email|\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
    }
    assert.match(loader, /\.eq\("is_registered", true\)/);
    assert.match(loader, /\.eq\("is_archived", false\)/);
    assert.match(loader, /loadReviewsOnce|loadPublishedReviews\(/);
  });
});

describe("the profile page points its shared preview at the card", () => {
  const page = read("lib/public/doctor-profile-page.tsx");
  const meta = page.slice(
    page.indexOf("export async function generateMetadata"),
    page.indexOf("export default async function DoctorPage"),
  );

  it("uses the generated card as the image, large, with its size and a description", () => {
    assert.match(meta, /profileShareCardVersion\(/);
    assert.match(meta, /profileShareCardPath\(/);
    assert.match(meta, /PROFILE_SHARE_CARD_SIZE/);
    assert.match(meta, /twitter: \{[^}]*card: "summary_large_image"/);
  });

  it("keeps the unregistered (directory) profiles on their own preview", () => {
    assert.match(meta, /buildManualDirectorySeoTitle/);
  });
});
