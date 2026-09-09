import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { denyUnlessInternalFounder } from "@/lib/internal-directory-auth";
import { isMasterSpecialty } from "@/lib/cyprus-specialties";
import { normalizeApprovedCustomSpecialty } from "@/lib/specialty-submission";
import { sendDoctorAccountRejectedEmail } from "@/lib/send-doctor-account-rejected-email";
import { getPublicBookingBaseUrl } from "@/lib/site-url";

type ReviewAction = "map" | "approve_new" | "approve_edited" | "reject_specialty";

type Body = {
  doctorId?: string;
  /**
   * doctor_specialties.id of the row under review. A professional can register
   * several specialties, so the pending one is not necessarily the primary.
   * Omitted by older clients — those fall back to professionals.specialty.
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
  doctor_id: string;
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
}): Promise<void> {
  try {
    await sendDoctorAccountRejectedEmail({
      siteUrl: getPublicBookingBaseUrl(),
      doctorEmail: String(professional.email ?? ""),
      doctorName: String(professional.name ?? "Doctor"),
      reason: "specialty",
      resendToOverride: process.env.RESEND_TO_OVERRIDE?.trim() || null,
    });
  } catch (err) {
    console.error("[specialty-review] application rejected email failed", err);
  }
}

function sameLabel(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Approves the reviewed row under `label`. When the professional already has that
 * specialty (unique on doctor_id + specialty), the duplicate pending row is dropped.
 */
async function approveSpecialtyRow(
  supabase: SupabaseClient,
  pending: SpecialtyRow,
  label: string,
): Promise<string | null> {
  const { data: siblings, error: siblingsError } = await supabase
    .from("doctor_specialties")
    .select("id, doctor_id, specialty, is_approved")
    .eq("doctor_id", pending.doctor_id);

  if (siblingsError) {
    console.error("[specialty-review] sibling load failed", siblingsError);
    return "Update failed.";
  }

  const clash = ((siblings ?? []) as SpecialtyRow[]).find(
    (row) => row.id !== pending.id && sameLabel(String(row.specialty ?? ""), label),
  );

  if (clash) {
    if (clash.is_approved !== true) {
      const { error } = await supabase
        .from("doctor_specialties")
        .update({ is_approved: true })
        .eq("id", clash.id);
      if (error) {
        console.error("[specialty-review] clash approve failed", error);
        return "Update failed.";
      }
    }
    const { error } = await supabase
      .from("doctor_specialties")
      .delete()
      .eq("id", pending.id);
    if (error) {
      console.error("[specialty-review] duplicate delete failed", error);
      return "Update failed.";
    }
    return null;
  }

  const { error } = await supabase
    .from("doctor_specialties")
    .update({ specialty: label, is_approved: true })
    .eq("id", pending.id);
  if (error) {
    console.error("[specialty-review] approve failed", error);
    return "Update failed.";
  }
  return null;
}

/**
 * Finds the `doctor_specialties` row under review. Clients that predate multi-specialty
 * omit `specialtyId`; that still resolves as long as exactly one row is unapproved.
 * Returns null when the junction has nothing to review (denormalized fallback).
 */
async function resolvePendingSpecialty(
  supabase: SupabaseClient,
  doctorId: string,
  specialtyId: string,
): Promise<SpecialtyRow | null | "not_found" | "already_approved"> {
  if (specialtyId) {
    const { data, error } = await supabase
      .from("doctor_specialties")
      .select("id, doctor_id, specialty, is_approved")
      .eq("id", specialtyId)
      .eq("doctor_id", doctorId)
      .maybeSingle();
    if (error || !data) return "not_found";
    const row = data as SpecialtyRow;
    return row.is_approved === true ? "already_approved" : row;
  }

  const { data, error } = await supabase
    .from("doctor_specialties")
    .select("id, doctor_id, specialty, is_approved")
    .eq("doctor_id", doctorId)
    .eq("is_approved", false);
  if (error) {
    console.error("[specialty-review] pending specialty lookup failed", error);
    return null;
  }
  const rows = (data ?? []) as SpecialtyRow[];
  return rows.length === 1 ? rows[0]! : null;
}

export async function POST(req: NextRequest) {
  const denied = denyUnlessInternalFounder();
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
    .select("id, name, email, specialty, is_specialty_approved, status")
    .eq("id", doctorId)
    .maybeSingle();

  if (fetchErr || !professional) {
    return NextResponse.json({ message: "Professional not found." }, { status: 404 });
  }

  if ((professional as { is_specialty_approved?: boolean }).is_specialty_approved) {
    return badRequest("This specialty is already approved.");
  }

  const currentStatus = String((professional as { status?: string | null }).status ?? "")
    .trim()
    .toLowerCase();

  // Resolve the target label up front so validation errors happen before any write.
  let targetLabel = "";
  if (action === "map") {
    targetLabel = typeof body.mapTo === "string" ? body.mapTo.trim() : "";
    if (!targetLabel || !isMasterSpecialty(targetLabel)) {
      return badRequest("mapTo must be a standard specialty from the master list.");
    }
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
    if (isMasterSpecialty(targetLabel)) {
      return badRequest(
        "This matches a standard specialty. Use 'Merge with existing' for canonical categories.",
      );
    }
  }

  const pending = await resolvePendingSpecialty(supabase, doctorId, specialtyId);
  if (pending === "not_found") {
    return NextResponse.json({ message: "Specialty not found." }, { status: 404 });
  }
  if (pending === "already_approved") {
    return badRequest("This specialty is already approved.");
  }

  if (pending) {
    if (action === "reject_specialty") {
      if (currentStatus === "verified") {
        return badRequest("Cannot reject specialty for an already verified professional.");
      }

      const { count, error: countErr } = await supabase
        .from("doctor_specialties")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", doctorId);

      if (countErr) {
        console.error("[specialty-review] specialty count failed", countErr);
        return NextResponse.json({ message: "Update failed." }, { status: 500 });
      }

      // Removing the only specialty would leave the profile empty — close the application.
      if ((count ?? 0) <= 1) {
        const { error } = await supabase
          .from("professionals")
          .update({
            status: "rejected",
            is_specialty_approved: false,
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
        .from("doctor_specialties")
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

  // Legacy path: no doctor_specialties row, so the denormalized column is the truth.
  if (action === "reject_specialty") {
    if (currentStatus === "verified") {
      return badRequest("Cannot reject specialty for an already verified professional.");
    }
    const { error } = await supabase
      .from("professionals")
      .update({
        status: "rejected",
        is_specialty_approved: false,
        ...clearRequiresStandard(),
      })
      .eq("id", doctorId);
    if (error) {
      console.error("[specialty-review] reject_specialty failed", error);
      return NextResponse.json({ message: "Update failed." }, { status: 500 });
    }
    await notifySpecialtyRejection(professional as { name?: string | null; email?: string | null });
    return NextResponse.json({ ok: true, status: "rejected", is_specialty_approved: false });
  }

  const label =
    action === "approve_new"
      ? normalizeApprovedCustomSpecialty(
          String((professional as { specialty?: string | null }).specialty ?? ""),
        )
      : targetLabel;
  if (!label) {
    return badRequest("Professional has no specialty text to approve.");
  }

  const { error } = await supabase
    .from("professionals")
    .update({
      specialty: label,
      is_specialty_approved: true,
      ...clearRequiresStandard(),
    })
    .eq("id", doctorId);

  if (error) {
    console.error("[specialty-review] approve failed", error);
    return NextResponse.json({ message: "Update failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, specialty: label, is_specialty_approved: true });
}
