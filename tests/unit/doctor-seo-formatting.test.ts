import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildNonLiveDoctorMetaTitle,
  buildRegisteredProfileMetaDescription,
  buildShareImageMetadata,
  buildVerifiedRegisteredMetaTitle,
  formatProfessionalSeoDisplayName,
  normalizeDistrictForSeoTitle,
  resolveShareAvatarUrl,
} from "../../lib/doctor-seo-formatting";

describe("formatProfessionalSeoDisplayName", () => {
  it("uses the stored name without adding Dr.", () => {
    assert.equal(formatProfessionalSeoDisplayName("Karina Miño"), "Karina Miño");
    assert.equal(formatProfessionalSeoDisplayName("  Anna Papadopoulos  "), "Anna Papadopoulos");
  });

  it("keeps an honorific already present in the stored name", () => {
    assert.equal(formatProfessionalSeoDisplayName("Dr. Maria Costa"), "Dr. Maria Costa");
  });
});

describe("normalizeDistrictForSeoTitle", () => {
  it("normalizes known districts", () => {
    assert.equal(normalizeDistrictForSeoTitle("paphos"), "Paphos");
    assert.equal(normalizeDistrictForSeoTitle("Limassol"), "Limassol");
  });
});

describe("registered profile share metadata", () => {
  it("builds verified title and description without inventing Dr.", () => {
    const title = buildVerifiedRegisteredMetaTitle({
      doctorName: "Karina Miño",
      specialty: "Psychology · Sexology",
      districtLabel: "Paphos",
    });
    const description = buildRegisteredProfileMetaDescription({
      status: "verified",
      doctorName: "Karina Miño",
      specialtyForSeo: "Psychology · Sexology",
      cityLabel: "Paphos",
    });

    assert.equal(
      title,
      "Book Online with Karina Miño | Psychology · Sexology in Paphos | DocCy",
    );
    assert.equal(
      description,
      "Book your next Psychology · Sexology appointment online with Karina Miño in Paphos. Secure scheduling via DocCy.",
    );
    assert.doesNotMatch(title ?? "", /\bDr\./i);
    assert.doesNotMatch(description, /\bDr\./i);
  });

  it("keeps Dr. only when already stored on the name", () => {
    const title = buildVerifiedRegisteredMetaTitle({
      doctorName: "Dr. Maria Costa",
      specialty: "Dermatology",
      districtLabel: "Nicosia",
    });
    assert.equal(
      title,
      "Book Online with Dr. Maria Costa | Dermatology in Nicosia | DocCy",
    );
  });

  it("builds non-live title without a booking promise or forced Dr.", () => {
    const title = buildNonLiveDoctorMetaTitle({
      doctorName: "Anna Papadopoulos",
      specialty: "Physiotherapy",
      districtLabel: "Limassol",
    });
    assert.equal(
      title,
      "Anna Papadopoulos | Physiotherapy in Limassol | Profile & Contact | DocCy",
    );
  });

  it("uses the real avatar URL for OG/Twitter share images", () => {
    const avatarUrl =
      "https://example.supabase.co/storage/v1/object/public/avatars/profiles/karina/avatar.jpg";
    const share = buildShareImageMetadata(avatarUrl);

    assert.deepEqual(share.openGraphImages, [{ url: avatarUrl }]);
    assert.deepEqual(share.twitterImages, [avatarUrl]);
    assert.equal(share.twitterCard, "summary_large_image");
  });

  it("emits no share image when avatar is missing (no stock doctor photo)", () => {
    const share = buildShareImageMetadata(null);
    assert.equal(share.openGraphImages, undefined);
    assert.equal(share.twitterImages, undefined);
    assert.equal(share.twitterCard, "summary");

    assert.equal(resolveShareAvatarUrl(null, () => "should-not-run"), null);
    assert.equal(resolveShareAvatarUrl("   ", () => "should-not-run"), null);
  });

  it("resolves storage avatar paths to public URLs and passes absolute URLs through", () => {
    const publicUrl = resolveShareAvatarUrl(
      "profiles/karina/avatar.jpg",
      (path) => `https://cdn.example/avatars/${path}`,
    );
    assert.equal(publicUrl, "https://cdn.example/avatars/profiles/karina/avatar.jpg");

    assert.equal(
      resolveShareAvatarUrl("https://cdn.example/already-public.jpg", () => "unused"),
      "https://cdn.example/already-public.jpg",
    );
  });
});
