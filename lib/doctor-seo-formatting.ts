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

/** Prefix with Dr. when the stored name does not already include it. */
export function withDoctorTitleHonorific(name: string): string {
  const n = name.trim();
  if (!n) return "";
  if (/^dr\.?\s/i.test(n)) return n;
  return `Dr. ${n}`;
}
