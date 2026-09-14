import type { SupabaseClient } from "@supabase/supabase-js";
import { parseProfessionalListingRef } from "@/lib/parse-professional-listing-ref";

export type ResolvedUnregisteredListing = {
  id: string;
  slug: string | null;
  isRegistered: boolean;
  isArchived: boolean;
};

export type ResolveUnregisteredListingResult =
  | { ok: true; listing: ResolvedUnregisteredListing }
  | { ok: false; status: 400 | 404 | 409 | 500; message: string };

export async function resolveUnregisteredListingFromUrl(
  supabase: SupabaseClient,
  listingUrl: string,
): Promise<ResolveUnregisteredListingResult> {
  const ref = parseProfessionalListingRef(listingUrl);
  if (!ref) {
    return {
      ok: false,
      status: 400,
      message: "Could not read a professional slug or id from that URL.",
    };
  }

  const lookup = await supabase
    .from("professionals")
    .select("id, slug, is_archived, is_registered")
    .eq(ref.kind === "uuid" ? "id" : "slug", ref.value)
    .maybeSingle();

  if (lookup.error) {
    console.error("[resolve-unregistered-listing] lookup failed", lookup.error);
    return {
      ok: false,
      status: 500,
      message: "Could not look up that listing.",
    };
  }

  const row = lookup.data as
    | {
        id?: string;
        slug?: string | null;
        is_archived?: boolean | null;
        is_registered?: boolean | null;
      }
    | null;

  if (!row?.id) {
    return {
      ok: false,
      status: 404,
      message: "No finder listing matched that URL. Check the link and try again.",
    };
  }

  if (row.is_registered) {
    return {
      ok: false,
      status: 400,
      message:
        "That URL points at a registered account, not an unregistered finder listing.",
    };
  }

  if (row.is_archived) {
    return {
      ok: false,
      status: 409,
      message:
        "That finder listing is already archived (often after absorb). It cannot be linked again.",
    };
  }

  return {
    ok: true,
    listing: {
      id: String(row.id),
      slug: String(row.slug ?? "").trim() || null,
      isRegistered: Boolean(row.is_registered),
      isArchived: Boolean(row.is_archived),
    },
  };
}
