import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { requireAdminWrite } from "@/lib/admin-auth";
import { loadSpecialtyCatalogueNames } from "@/lib/specialty-catalogue";
import { matchCatalogueSpecialty } from "@/lib/specialty-options";
import { normalizeApprovedCustomSpecialty } from "@/lib/specialty-submission";
import { sendDoctorAccountRejectedEmail } from "@/lib/send-doctor-account-rejected-email";
import { getPublicBookingBaseUrl } from "@/lib/site-url";
import { professionalAccountEmail } from "@/lib/professional-account-contact";
import { sameSpecialtySlug } from "@/lib/professional-specialty-writes";

type ReviewAction = "map" | "approve_new" | "approve_edited" | "reject_specialty";

type Body = {
  doctorId?: string;
  /**
   * professional_specialties.id of the row under review. A professional can register
   * several specialties, so the pending one is not necessarily the first. Optional
   * while exactly one of the professional's specialties is pending.
   */
  specialtyId?: string | null;
  action?: ReviewAction;
  /** Required when action is map — must be a canonical master specialty */
  mapTo?: string;
  /** Required when action is approve_edited */
  editedSpecialty?: string;
};

type SpecialtyRow = {
  id: string;
  professional_id: string;
  specialty: string | null;
  is_approved: boolean | null;
};

function clearRequiresStandard() {
  return { specialty_requires_standard_at: null };
}

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

async function notifySpecialtyRejection(professional: {
  name?: string | null;
  email?: string | null;
  registration_email?: string | null;
}): Promise<void> {
  try {
    await sendDoctorAccountRejectedEmail({
      siteUrl: getPublicBookingBaseUrl(),
      doctorEmail: professionalAccountEmail(professional),
      doctorName: String(professional.name ?? "Doctor"),
      reason: "specialty",
      resendToOverride: process.env.RESEND_TO_OVERRIDE?.trim() || null,
    });
  } catch (err) {
    console.error("[specialty-review] application rejected email failed", err);
  }
}

const SPECIALTY_ROW_SELECT = "id, professional_id, specialty, is_approved";

/**
 * Approves the reviewed row under `label`. When the professional already has that
 * specialty (same slug, the table's key), the duplicate pending row is dropped.
 */
async function approveSpecialtyRow(
  supabase: SupabaseClient,
  pending: SpecialtyRow,
  label: string,
): Promise<string | null> {
  const { data: siblings, error: siblingsError } = await supabase
    .from("professional_specialties")
    .select(SPECIALTY_ROW_SELECT)
    .eq("professional_id", pending.professional_id);

  if (siblingsError) {
    console.error("[specialty-review] sibling load failed", siblingsError);
    return "Update failed.";
  }

  const clash = ((siblings ?? []) as SpecialtyRow[]).find(
    (row) => row.id !== pending.id && sameSpecialtySlug(String(row.specialty ?? ""), label),
  );

  if (clash) {
    if (clash.is_approved !== true) {
      const { error } = await supabase
        .from("professional_specialties")
        .update({ is_approved: true })
        .eq("id", clash.id);
      if (error) {
        console.error("[specialty-review] clash approve failed", error);
        return "Update failed.";
      }
    }
    const { error } = await supabase
      .from("professional_specialties")
      .delete()
      .eq("id", pending.id);
    if (error) {
      console.error("[specialty-review] duplicate delete failed", error);
      return "Update failed.";
    }
    return null;
  }

  const { error } = await supabase
    .from("professional_specialties")
    .update({ specialty: label, is_approved: true })
    .eq("id", pending.id);
  if (error) {
    console.error("[specialty-review] approve failed", error);
    return "Update failed.";
  }
  return null;
}

type PendingResolution =
  | { kind: "row"; row: SpecialtyRow }
  | { kind: "not_found" }
  | { kind: "already_approved" }
  | { kind: "ambiguous" }
  | { kind: "error" };

/**
 * Finds the `professional_specialties` row under review. Without `specialtyId` it
 * resolves only while exactly one of the professional's specialties is pending.
 */
async function resolvePendingSpecialty(
  supabase: SupabaseClient,
  professionalId: string,
  specialtyId: string,
): Promise<PendingResolution> {
  if (specialtyId) {
    const { data, error } = await supabase
      .from("professional_specialties")
      .select(SPECIALTY_ROW_SELECT)
      .eq("id", specialtyId)
      .eq("professional_id", professionalId)
      .maybeSingle();
    if (error || !data) return { kind: "not_found" };
    const row = data as SpecialtyRow;
    return row.is_approved === true ? { kind: "already_approved" } : { kind: "row", row };
  }

  const { data, error } = await supabase
    .from("professional_specialties")
    .select(SPECIALTY_ROW_SELECT)
    .eq("professional_id", professionalId)
    .eq("is_approved", false);
  if (error) {
    console.error("[specialty-review] pending specialty lookup failed", error);
    return { kind: "error" };
  }
  const rows = (data ?? []) as SpecialtyRow[];
  if (rows.length === 0) return { kind: "already_approved" };
  if (rows.length > 1) return { kind: "ambiguous" };
  return { kind: "row", row: rows[0]! };
}

export async function POST(req: NextRequest) {
  const { response: denied } = await requireAdminWrite();
  if (denied) return denied;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Server not configured." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest("Invalid JSON.");
  }

  const doctorId = typeof body.doctorId === "string" ? body.doctorId.trim() : "";
  const specialtyId = typeof body.specialtyId === "string" ? body.specialtyId.trim() : "";
  const action = body.action;

  if (
    !doctorId ||
    (action !== "map" &&
      action !== "approve_new" &&
      action !== "approve_edited" &&
      action !== "reject_specialty")
  ) {
    return badRequest(
      "doctorId and action (map | approve_new | approve_edited | reject_specialty) are required.",
    );
  }

  const { data: professional, error: fetchErr } = await supabase
    .from("professionals")
    .select("id, name, email, registration_email, status")
    .eq("id", doctorId)
    .maybeSingle();

  if (fetchErr || !professional) {
    return NextResponse.json({ message: "Professional not found." }, { status: 404 });
  }

  const currentStatus = String((professional as { status?: string | null }).status ?? "")
    .trim()
    .toLowerCase();

  // Resolve the target label up front so validation errors happen before any write.
  let targetLabel = "";
  const catalogue =
    action === "map" || action === "approve_edited"
      ? await loadSpecialtyCatalogueNames(supabase)
      : [];
  if (action === "map") {
    const mapTo = typeof body.mapTo === "string" ? body.mapTo.trim() : "";
    const match = mapTo ? matchCatalogueSpecialty(catalogue, mapTo) : null;
    if (!match || match.viaAlias) {
      return badRequest("mapTo must be a standard specialty from the catalogue.");
    }
    targetLabel = match.name;
  } else if (action === "approve_edited") {
    targetLabel = normalizeApprovedCustomSpecialty(
      typeof body.editedSpecialty === "string" ? body.editedSpecialty : "",
    );
    if (!targetLabel) {
      return badRequest("editedSpecialty is required.");
    }
    if (targetLabel.length > 120) {
      return badRequest("Custom specialty must be 120 characters or less.");
    }
    if (matchCatalogueSpecialty(catalogue, targetLabel)) {
      return badRequest(
        "This matches a standard specialty. Use 'Merge with existing' for canonical categories.",
      );
    }
  }

  const resolved = await resolvePendingSpecialty(supabase, doctorId, specialtyId);
  if (resolved.kind === "not_found") {
    return NextResponse.json({ message: "Specialty not found." }, { status: 404 });
  }
  if (resolved.kind === "already_approved") {
    return badRequest("This specialty is already approved.");
  }
  if (resolved.kind === "ambiguous") {
    return badRequest("Several specialties are pending; specialtyId is required.");
  }
  if (resolved.kind === "error") {
    return NextResponse.json({ message: "Update failed." }, { status: 500 });
  }
  const pending = resolved.row;

  if (action === "reject_specialty") {
    if (currentStatus === "verified") {
      return badRequest("Cannot reject specialty for an already verified professional.");
    }

    const { count, error: countErr } = await supabase
      .from("professional_specialties")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", doctorId);

    if (countErr) {
      console.error("[specialty-review] specialty count failed", countErr);
      return NextResponse.json({ message: "Update failed." }, { status: 500 });
    }

    // Removing the only specialty would leave the profile empty — close the application.
    // The row stays unapproved, so the professional stays flagged for specialty review.
    if ((count ?? 0) <= 1) {
      const { error } = await supabase
        .from("professionals")
        .update({
          status: "rejected",
          ...clearRequiresStandard(),
        })
        .eq("id", doctorId);
      if (error) {
        console.error("[specialty-review] reject_specialty failed", error);
        return NextResponse.json({ message: "Update failed." }, { status: 500 });
      }
      await notifySpecialtyRejection(professional as { name?: string | null; email?: string | null });
      return NextResponse.json({
        ok: true,
        status: "rejected",
        removed: pending.specialty ?? null,
        is_specialty_approved: false,
      });
    }

    const { error: deleteErr } = await supabase
      .from("professional_specialties")
      .delete()
      .eq("id", pending.id);
    if (deleteErr) {
      console.error("[specialty-review] specialty removal failed", deleteErr);
      return NextResponse.json({ message: "Update failed." }, { status: 500 });
    }
    await supabase
      .from("professionals")
      .update(clearRequiresStandard())
      .eq("id", doctorId);

    return NextResponse.json({
      ok: true,
      status: currentStatus || null,
      removed: pending.specialty ?? null,
    });
  }

  const label =
    action === "approve_new"
      ? normalizeApprovedCustomSpecialty(String(pending.specialty ?? ""))
      : targetLabel;
  if (!label) {
    return badRequest("This specialty has no text to approve.");
  }

  const failure = await approveSpecialtyRow(supabase, pending, label);
  if (failure) {
    return NextResponse.json({ message: failure }, { status: 500 });
  }

  await supabase.from("professionals").update(clearRequiresStandard()).eq("id", doctorId);

  return NextResponse.json({ ok: true, specialty: label, is_specialty_approved: true });
}
