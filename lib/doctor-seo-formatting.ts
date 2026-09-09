import { CYPRUS_DISTRICTS, isCyprusDistrict } from "@/lib/cyprus-districts";
import { slugToDistrict } from "@/lib/finder-seo";

export function normalizeDistrictForSeoTitle(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (isCyprusDistrict(s)) return s;
  const fromSlug = slugToDistrict(s);
  if (fromSlug) return fromSlug;
  const lower = s.toLowerCase();
  for (const d of CYPRUS_DISTRICTS) {
    if (d.toLowerCase() === lower) return d;
  }
  return null;
}

/**
 * Display name for registered-profile SEO (tab title, OG, descriptions).
 * Do not auto-prefix "Dr." — DocCy lists health professionals who are not all physicians.
 * Keep any honorific already present in the stored name.
 */
export function formatProfessionalSeoDisplayName(name: string): string {
  return name.trim();
}

export function buildVerifiedRegisteredMetaTitle(input: {
  doctorName: string;
  specialty: string;
  districtLabel: string | null;
}): string | null {
  const name = formatProfessionalSeoDisplayName(input.doctorName);
  if (!name) return null;
  const spec = input.specialty.trim();
  const city = input.districtLabel?.trim() || "Cyprus";
  if (spec.length > 0) {
    return `Book Online with ${name} | ${spec} in ${city} | DocCy`;
  }
  return `Book Online with ${name} in ${city} | DocCy`;
}

/** Pending / rejected slug pages: informative, no instant-booking promise. */
export function buildNonLiveDoctorMetaTitle(input: {
  doctorName: string;
  specialty: string;
  districtLabel: string | null;
}): string | null {
  const name = formatProfessionalSeoDisplayName(input.doctorName);
  if (!name) return null;
  const spec = input.specialty.trim();
  const city = input.districtLabel?.trim() || "Cyprus";
  if (spec.length > 0) {
    return `${name} | ${spec} in ${city} | Profile & Contact | DocCy`;
  }
  return `${name} in ${city} | Profile & Contact | DocCy`;
}

export function buildRegisteredProfileMetaDescription(input: {
  status: string;
  doctorName: string;
  specialtyForSeo: string;
  cityLabel: string;
}): string {
  const doctorName = formatProfessionalSeoDisplayName(input.doctorName);
  const specialtyForSeo = input.specialtyForSeo.trim();
  const cityLabel = input.cityLabel.trim() || "Cyprus";
  const st = input.status.trim().toLowerCase();

  if (st === "verified" && specialtyForSeo.length > 0) {
    return `Book your next ${specialtyForSeo} appointment online with ${doctorName} in ${cityLabel}. Secure scheduling via DocCy.`;
  }
  if (st === "verified") {
    return `Book online with ${doctorName} in ${cityLabel} via DocCy.`;
  }
  if (specialtyForSeo.length > 0) {
    return `View profile and contact details for ${doctorName} (${specialtyForSeo} in ${cityLabel}) on DocCy.`;
  }
  return `View profile and contact details for ${doctorName} in ${cityLabel} on DocCy.`;
}

/**
 * Resolve a stored avatar path or absolute URL for share/OG tags.
 * Never invents a stock doctor photo — missing/blank returns null.
 */
export function resolveShareAvatarUrl(
  avatarPathOrUrl: string | null | undefined,
  getStoragePublicUrl: (path: string) => string,
): string | null {
  const raw = String(avatarPathOrUrl ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const publicUrl = String(getStoragePublicUrl(raw) ?? "").trim();
  return publicUrl || null;
}

export type ShareImageMetadata = {
  openGraphImages?: { url: string }[];
  twitterCard: "summary_large_image" | "summary";
  twitterImages?: string[];
};

/** Only emit share images when a real avatar URL is available. */
export function buildShareImageMetadata(
  imageUrl: string | null | undefined,
): ShareImageMetadata {
  const url = String(imageUrl ?? "").trim();
  if (!url) {
    return { twitterCard: "summary" };
  }
  return {
    openGraphImages: [{ url }],
    twitterCard: "summary_large_image",
    twitterImages: [url],
  };
}
