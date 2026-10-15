import { finderResultsPath } from "@/lib/finder-public-path";
import { normalizeDistrictForSeoTitle } from "@/lib/doctor-seo-formatting";

export type ProfileBreadcrumb = { label: string; href: string | null };

/**
 * "Dermatology › Nicosia › Dr. Eleni Georgiou", like the finder's own pages: the
 * primary specialty island-wide, then that specialty in the primary district, then
 * the profile (not a link).
 */
export function profileBreadcrumbs(input: {
  specialty: string | null | undefined;
  district: string | null | undefined;
  name: string;
}): ProfileBreadcrumb[] {
  const specialty = String(input.specialty ?? "").trim();
  const district = normalizeDistrictForSeoTitle(input.district);
  const crumbs: ProfileBreadcrumb[] = [];
  if (specialty) crumbs.push({ label: specialty, href: finderResultsPath(null, specialty) });
  if (district) crumbs.push({ label: district, href: finderResultsPath(district, specialty || null) });
  crumbs.push({ label: input.name, href: null });
  return crumbs;
}
