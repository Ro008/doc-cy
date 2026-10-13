import { createHash } from "node:crypto";

/**
 * The picture under a shared profile link (WhatsApp, social previews). It is drawn at
 * /api/og/profile/[slug] and cached for a year per version: the link carries `v`, a short
 * hash of every fact drawn on the card, so a change (new photo, new reviews) is a new
 * address that crawlers fetch afresh, and the same address never has to be drawn twice.
 * The route draws only when `v` is the current one, so a crawler cannot make the server
 * draw by inventing versions.
 */

export const PROFILE_SHARE_CARD_SIZE = { width: 1200, height: 630 } as const;

export type ProfileShareCardFacts = {
  name: string;
  /** Storage path or URL of the photo, as stored; the card draws the photo behind it. */
  avatarPath: string | null;
  specialties: readonly string[];
  /** Primary district, the one the profile heading uses. */
  district: string | null;
  /** Count and average from published reviews; null below the 3-review bar. */
  rating: { count: number; average: number } | null;
};

export function profileShareCardVersion(facts: ProfileShareCardFacts): string {
  const canonical = JSON.stringify([
    facts.name.trim(),
    facts.avatarPath ?? "",
    facts.specialties.map((label) => label.trim()),
    facts.district ?? "",
    facts.rating ? [facts.rating.count, facts.rating.average] : null,
  ]);
  return createHash("sha1").update(canonical).digest("hex").slice(0, 10);
}

/** "Dentist · Biochemistry · Cardiology · +2": the card has room for three. */
export function shareCardSpecialtyLine(specialties: readonly string[]): string {
  const labels = specialties.map((label) => label.trim()).filter(Boolean);
  if (labels.length <= 3) return labels.join(" · ");
  return `${labels.slice(0, 3).join(" · ")} · +${labels.length - 3}`;
}

export function isValidShareCardSlug(slug: string): boolean {
  return /^[a-z0-9-]{1,120}$/.test(slug);
}

export function profileShareCardPath(slug: string, version: string): string {
  return `/api/og/profile/${slug}?v=${version}`;
}
