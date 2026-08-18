/**
 * Pure helpers for professional ↔ clinic interlinking (manual directory).
 */

export type ManualClinicJoinClinic = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  address?: string | null;
  address_maps_link?: string | null;
  district?: string | null;
  is_archived?: boolean | null;
  /** Server-only; stripped to `hasPhone` before sending to the client. */
  phone?: string | null;
};

export type ManualClinicJoinLink = {
  clinic_id?: string | null;
  is_primary?: boolean | null;
  clinics?: ManualClinicJoinClinic | null;
};

export type ManualClinicRef = {
  id: string | null;
  name: string;
  slug: string;
  isPrimary: boolean;
  address: string | null;
  addressMapsLink: string | null;
  district: string | null;
  /** Phone exists server-side; value is never included on this ref. */
  hasPhone: boolean;
};

/**
 * Build ordered clinic refs from `directory_manual_clinics` join rows.
 * Primary first; skips archived / incomplete; dedupes by clinic id then slug.
 */
export function buildManualDirectoryClinicRefs(
  links: readonly ManualClinicJoinLink[],
): ManualClinicRef[] {
  const sorted = [...links].sort((a, b) => {
    const ap = Boolean(a.is_primary);
    const bp = Boolean(b.is_primary);
    if (ap === bp) return 0;
    return ap ? -1 : 1;
  });

  const out: ManualClinicRef[] = [];
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();

  for (const link of sorted) {
    const clinic = link.clinics;
    if (!clinic || clinic.is_archived) continue;
    const clinicId = String(link.clinic_id ?? clinic.id ?? "").trim();

    const name = String(clinic.name ?? "").trim();
    const slug = String(clinic.slug ?? "").trim();
    if (!name || !slug) continue;

    if (clinicId) {
      if (seenIds.has(clinicId)) continue;
      seenIds.add(clinicId);
    } else if (seenSlugs.has(slug.toLowerCase())) {
      continue;
    }
    seenSlugs.add(slug.toLowerCase());

    out.push({
      id: clinicId || null,
      name,
      slug,
      isPrimary: Boolean(link.is_primary),
      address: String(clinic.address ?? "").trim() || null,
      addressMapsLink: String(clinic.address_maps_link ?? "").trim() || null,
      district: String(clinic.district ?? "").trim() || null,
      hasPhone: Boolean(String(clinic.phone ?? "").trim()),
    });
  }

  // Ensure exactly one primary when we have clinics (first wins if none flagged).
  if (out.length > 0 && !out.some((c) => c.isPrimary)) {
    out[0] = { ...out[0]!, isPrimary: true };
  }

  return out;
}

export function formatClinicCountLabel(count: number): string {
  if (count <= 0) return "";
  return count === 1 ? "1 clinic" : `${count} clinics`;
}

export function formatMoreClinicsLabel(extraCount: number): string {
  if (extraCount <= 0) return "";
  return extraCount === 1 ? "+1 more clinic" : `+${extraCount} more clinics`;
}

/** True if the professional's home district or any linked clinic is in `district`. */
export function professionalMatchesDistrictFilter(input: {
  district: string | null | undefined;
  clinicDistricts?: readonly (string | null | undefined)[] | null;
  activeDistrict: string;
}): boolean {
  const active = String(input.activeDistrict ?? "").trim().toLowerCase();
  if (!active) return true;
  const primary = String(input.district ?? "").trim().toLowerCase();
  if (primary && primary === active) return true;
  for (const d of input.clinicDistricts ?? []) {
    if (String(d ?? "").trim().toLowerCase() === active) return true;
  }
  return false;
}
