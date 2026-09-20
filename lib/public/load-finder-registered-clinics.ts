import { cache } from "react";

import type { ManualClinicRef } from "@/lib/manual-directory-clinics";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { fetchAllSupabaseRowsForIdChunks } from "@/lib/supabase-fetch-all";

export type FinderRegisteredClinics = {
  /**
   * Keyed by `professional_clinics.id`, which the Stage 1 backfill
   * (20260918093247_professional_clinics_rich_join_table) deliberately set to the
   * matching `doctor_locations.id`. A registered finder card renders one block per
   * doctor_locations row, so its `location.id` looks the clinic up exactly -- no
   * address matching, no guessing which clinic a location means.
   */
  byLocationId: Map<string, ManualClinicRef>;
  /** Fallback for cards with no doctor_locations rows at all. */
  byProfessionalId: Map<string, ManualClinicRef[]>;
};

type JoinClinic = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  address?: string | null;
  address_maps_link?: string | null;
  district?: string | null;
  is_archived?: boolean | null;
  phone?: string | null;
};

type JoinRow = {
  id?: string | null;
  professional_id?: string | null;
  is_primary?: boolean | null;
  /** PostgREST types an embed as an array; a to-one join still arrives as an object. */
  clinics?: JoinClinic | JoinClinic[] | null;
};

function emptyResult(): FinderRegisteredClinics {
  return { byLocationId: new Map(), byProfessionalId: new Map() };
}

/**
 * Clinic identity for registered finder cards.
 *
 * Registered cards used to show a bare `professionals.clinic_address` string while
 * unregistered ones showed a linked clinic name, because only the manual path read
 * `professional_clinics -> clinics`. This loads the same join for registered
 * professionals so both card types can render the same location block.
 *
 * Request-memoized on the same `doctorIdsKey` as the availability batch, so all the
 * streamed cards on a page share one query.
 */
export const loadFinderRegisteredClinics = cache(
  async (doctorIdsKey: string): Promise<FinderRegisteredClinics> => {
    const ids = doctorIdsKey.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) return emptyResult();

    const supabase = createServiceRoleClient();
    if (!supabase) return emptyResult();

    const res = await fetchAllSupabaseRowsForIdChunks(ids, (idChunk) =>
      supabase
        .from("professional_clinics")
        .select(
          "id, professional_id, is_primary, clinics ( id, name, slug, address, address_maps_link, district, is_archived, phone )",
        )
        .in("professional_id", idChunk),
    );

    if (res.error) {
      console.error("[DocCy] finder registered clinics load failed:", res.error);
      return emptyResult();
    }

    const out = emptyResult();
    // Primary first, so the per-professional fallback list leads with the main clinic.
    const rows = ([...((res.data ?? []) as unknown as JoinRow[])]).sort((a, b) => {
      const ap = Boolean(a.is_primary);
      const bp = Boolean(b.is_primary);
      if (ap === bp) return 0;
      return ap ? -1 : 1;
    });

    for (const row of rows) {
      const clinic = Array.isArray(row.clinics) ? row.clinics[0] : row.clinics;
      // Same rules as buildManualDirectoryClinicRefs: archived or incomplete is not shown.
      if (!clinic || clinic.is_archived) continue;

      const name = String(clinic.name ?? "").trim();
      const slug = String(clinic.slug ?? "").trim();
      if (!name || !slug) continue;

      const ref: ManualClinicRef = {
        id: String(clinic.id ?? "").trim() || null,
        name,
        slug,
        isPrimary: Boolean(row.is_primary),
        address: String(clinic.address ?? "").trim() || null,
        addressMapsLink: String(clinic.address_maps_link ?? "").trim() || null,
        district: String(clinic.district ?? "").trim() || null,
        hasPhone: Boolean(String(clinic.phone ?? "").trim()),
      };

      const joinId = String(row.id ?? "").trim();
      if (joinId) out.byLocationId.set(joinId, ref);

      const professionalId = String(row.professional_id ?? "").trim();
      if (!professionalId) continue;
      const list = out.byProfessionalId.get(professionalId) ?? [];
      if (!list.some((c) => (ref.id && c.id === ref.id) || c.slug === ref.slug)) {
        list.push(ref);
        out.byProfessionalId.set(professionalId, list);
      }
    }

    return out;
  },
);
