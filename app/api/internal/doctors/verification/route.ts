import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { denyUnlessInternalFounder } from "@/lib/internal-directory-auth";
import { verificationBlockedReason } from "@/lib/doctor-specialty-public";
import { hasPendingSpecialty, loadSpecialtyEntries } from "@/lib/specialty-catalogue";
import { sendDoctorAccountVerifiedEmail } from "@/lib/send-doctor-account-verified-email";
import { sendDoctorAccountRejectedEmail } from "@/lib/send-doctor-account-rejected-email";
import { professionalAccountEmail } from "@/lib/professional-account-contact";
import { getPublicBookingBaseUrl } from "@/lib/site-url";
import { realignDoctorSlugIfNameChanged } from "@/lib/doctor-slug";
import { resolveUnregisteredListingFromUrl } from "@/lib/resolve-unregistered-listing-from-url";
import { parseDirectoryClaimSource } from "@/lib/pending-registration-origin";
import { locationsToAddForAbsorbedClinics } from "@/lib/absorbed-clinic-locations";
import { MAX_DOCTOR_LOCATIONS } from "@/lib/doctor-locations";
import type { SupabaseClient } from "@supabase/supabase-js";

type Body = {
  doctorId?: string;
  action?: "verify" | "reject";
  listingUrl?: string;
};

/**
 * Card-link claims never mutate the claimed listing at signup (see
 * app/register/page.tsx) — it stays live in /finder, untouched, for the whole
 * pending window. `claim_listing_id` just remembers which listing to merge.
 * Validate it's still a safe absorb target right before we do it.
 */
async function resolveClaimListingForVerify(
  supabase: SupabaseClient,
  claimListingId: string,
): Promise<{ ok: true; id: string } | { ok: false; status: 404 | 409; message: string }> {
  const { data, error } = await supabase
    .from("professionals")
    .select("id, is_archived, is_registered")
    .eq("id", claimListingId)
    .maybeSingle();

  if (error || !data?.id) {
    return {
      ok: false,
      status: 404,
      message:
        "The finder listing this registration claimed could not be found anymore. Paste its URL manually if it still exists, or verify without it.",
    };
  }
  if (data.is_registered) {
    return {
      ok: false,
      status: 409,
      message:
        "The finder listing this registration claimed is already registered by someone else now. Resolve manually before verifying.",
    };
  }
  if (data.is_archived) {
    return {
      ok: false,
      status: 409,
      message: "The finder listing this registration claimed is already archived.",
    };
  }
  return { ok: true, id: String(data.id) };
}

type AbsorbedClinicRow = {
  id?: string | null;
  address?: string | null;
  town?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  clinic_place_id?: string | null;
  is_archived?: boolean | null;
};

/** PostgREST types an embed as an array; a to-one join still arrives as an object. */
type AbsorbedClinicJoin = { clinics?: AbsorbedClinicRow | AbsorbedClinicRow[] | null };

/**
 * Give every clinic now linked to this professional a practice location, unless one of
 * theirs is already at that address. Best effort: the absorb has already committed, and
 * a missing location is recoverable, so this never fails the verification.
 */
async function addLocationsForAbsorbedClinics(
  supabase: SupabaseClient,
  doctorId: string,
): Promise<void> {
  const [links, locations] = await Promise.all([
    supabase
      .from("professional_clinics")
      .select(
        "clinics ( id, address, town, district, latitude, longitude, clinic_place_id, is_archived )",
      )
      .eq("professional_id", doctorId)
      .limit(MAX_DOCTOR_LOCATIONS),
    supabase
      .from("doctor_locations")
      .select("clinic_address, sort_order")
      .eq("doctor_id", doctorId),
  ]);

  if (links.error || locations.error) {
    console.error(
      "[internal/doctors/verification] absorbed clinic locations lookup failed",
      links.error ?? locations.error,
    );
    return;
  }

  const clinics = ((links.data ?? []) as unknown as AbsorbedClinicJoin[])
    .map((row) => (Array.isArray(row.clinics) ? row.clinics[0] : row.clinics))
    .filter((clinic): clinic is AbsorbedClinicRow => Boolean(clinic) && !clinic?.is_archived);

  const toAdd = locationsToAddForAbsorbedClinics({
    clinics,
    existingLocations: locations.data ?? [],
  });
  if (toAdd.length === 0) return;

  const { error } = await supabase
    .from("doctor_locations")
    .insert(toAdd.map((location) => ({ ...location, doctor_id: doctorId })));
  if (error) {
    console.error("[internal/doctors/verification] absorbed clinic locations insert failed", error);
  }
}

export async function POST(req: NextRequest) {
  const denied = denyUnlessInternalFounder();
  if (denied) return denied;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json(
      { message: "Server is not configured for internal tools." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 });
  }

  const doctorId = typeof body.doctorId === "string" ? body.doctorId.trim() : "";
  const action = body.action;
  const listingUrl = String(body.listingUrl ?? "").trim();

  if (!doctorId || (action !== "verify" && action !== "reject")) {
    return NextResponse.json(
      { message: "doctorId and action (verify | reject) are required." },
      { status: 400 },
    );
  }

  const { data: row, error: fetchErr } = await supabase
    .from("professionals")
    .select(
      "id, name, email, registration_email, status, specialty_requires_standard_at, slug, district, auth_user_id, directory_claim_source, claim_listing_id, avatar_url",
    )
    .eq("id", doctorId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ message: "Professional not found." }, { status: 404 });
  }

  const currentStatus = String((row as { status?: string | null }).status ?? "")
    .trim()
    .toLowerCase();

  if (currentStatus !== "pending") {
    return NextResponse.json(
      {
        message:
          currentStatus === "verified"
            ? "This professional is already verified."
            : "This application is closed (rejected).",
      },
      { status: 400 },
    );
  }

  const blockReason = verificationBlockedReason({
    is_specialty_approved: !hasPendingSpecialty(await loadSpecialtyEntries(supabase, doctorId)),
    specialty_requires_standard_at: (
      row as { specialty_requires_standard_at?: string | null }
    ).specialty_requires_standard_at,
  });
  if (blockReason) {
    return NextResponse.json({ message: blockReason }, { status: 400 });
  }

  const claimSource = parseDirectoryClaimSource(
    (row as { directory_claim_source?: string | null }).directory_claim_source,
  );
  const authUserId = String((row as { auth_user_id?: string | null }).auth_user_id ?? "").trim();

  if (action === "reject") {
    // Card-link claims never touch the claimed listing at signup (it stays
    // live/untouched in /finder the whole time) — same as Unclaimed rows,
    // which never touch any listing either until a founder pastes a URL at
    // Verify. So Reject is uniform for both: just close the application.
    // Nothing in /finder ever changes.
    const { data: updated, error } = await supabase
      .from("professionals")
      .update({ status: "rejected" })
      .eq("id", doctorId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[internal/doctors/verification] reject failed", error);
      return NextResponse.json(
        { message: "Could not update professional status." },
        { status: 500 },
      );
    }

    if (!updated) {
      return NextResponse.json({ message: "Professional not found." }, { status: 404 });
    }

    try {
      await sendDoctorAccountRejectedEmail({
        siteUrl: getPublicBookingBaseUrl(),
        doctorEmail: professionalAccountEmail(
          row as { email?: string | null; registration_email?: string | null },
        ),
        doctorName: String((row as { name?: string | null }).name ?? "Doctor"),
        reason: "license",
        resendToOverride: process.env.RESEND_TO_OVERRIDE?.trim() || null,
      });
    } catch (err) {
      console.error("[internal/doctors/verification] account rejected email failed", err);
    }

    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // action === "verify" from here.

  let absorbed = false;

  if (claimSource === "card_link") {
    const claimListingId = String(
      (row as { claim_listing_id?: string | null }).claim_listing_id ?? "",
    ).trim();

    if (claimListingId) {
      const resolved = await resolveClaimListingForVerify(supabase, claimListingId);
      if (resolved.ok === false) {
        return NextResponse.json({ message: resolved.message }, { status: resolved.status });
      }

      const { error: absorbErr } = await supabase.rpc("absorb_unregistered_into_registered", {
        p_registered_id: doctorId,
        p_unregistered_id: resolved.id,
      });
      if (absorbErr) {
        console.error("[internal/doctors/verification] claim absorb failed", absorbErr);
        return NextResponse.json({ message: "Could not absorb listing." }, { status: 500 });
      }
      absorbed = true;
    }
  } else if (listingUrl) {
    const resolved = await resolveUnregisteredListingFromUrl(supabase, listingUrl);
    if (resolved.ok === false) {
      return NextResponse.json({ message: resolved.message }, { status: resolved.status });
    }

    if (resolved.listing.id === doctorId) {
      return NextResponse.json(
        { message: "That URL is already this registration's profile." },
        { status: 400 },
      );
    }

    const { error: absorbErr } = await supabase.rpc("absorb_unregistered_into_registered", {
      p_registered_id: doctorId,
      p_unregistered_id: resolved.listing.id,
    });
    if (absorbErr) {
      console.error("[internal/doctors/verification] absorb failed", absorbErr);
      return NextResponse.json({ message: "Could not absorb listing." }, { status: 500 });
    }
    absorbed = true;
  }

  // An absorbed clinic is a workplace the listing advertised publicly until now. It
  // arrives as a professional_clinics row, which nothing on the professional's own
  // profile renders, so without this it disappears the moment we verify them.
  if (absorbed) {
    await addLocationsForAbsorbedClinics(supabase, doctorId);
  }

  if (authUserId) {
    await realignDoctorSlugIfNameChanged(supabase, {
      doctorId,
      name: String((row as { name?: string | null }).name ?? ""),
      district: (row as { district?: string | null }).district ?? null,
      authUserId,
      currentSlug: (row as { slug?: string | null }).slug ?? null,
    });
  }

  const { data: updated, error } = await supabase
    .from("professionals")
    .update({ status: "verified" })
    .eq("id", doctorId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[internal/doctors/verification] verify failed", error);
    return NextResponse.json(
      { message: "Could not update professional status." },
      { status: 500 },
    );
  }

  if (!updated) {
    return NextResponse.json({ message: "Professional not found." }, { status: 404 });
  }

  try {
    await sendDoctorAccountVerifiedEmail({
      siteUrl: getPublicBookingBaseUrl(),
      doctorEmail: professionalAccountEmail(
        row as { email?: string | null; registration_email?: string | null },
      ),
      doctorName: String((row as { name?: string | null }).name ?? "Doctor"),
      resendToOverride: process.env.RESEND_TO_OVERRIDE?.trim() || null,
    });
  } catch (err) {
    console.error("[internal/doctors/verification] account verified email failed", err);
  }

  return NextResponse.json({ ok: true, status: "verified" });
}
