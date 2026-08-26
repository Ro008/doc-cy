import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isInternalDirectoryAuthenticated } from "@/lib/internal-directory-auth";
import { isSupabaseMissingTableError } from "@/lib/supabase-db-errors";
import {
  normalizeFounderNote,
  validateSpecialtyChangeRequestInput,
} from "@/lib/doctor-specialty-change-request";
import { isMasterSpecialty } from "@/lib/cyprus-specialties";

type Body = {
  requestId?: string;
  action?: "approve" | "reject";
  /** Optional override when approving (typo fix / canonical label). */
  toSpecialty?: string;
  toSpecialtyFromMaster?: boolean | string | number;
  /** Optional override for license number written to doctors.license_number. */
  licenseNumber?: string;
  founderNote?: string;
};

/** POST — founder approves or rejects a specialty change request. */
export async function POST(req: NextRequest) {
  if (!isInternalDirectoryAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Server not configured." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 });
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const action = body.action;
  if (!requestId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json(
      { message: "requestId and action (approve | reject) are required." },
      { status: 400 },
    );
  }

  const { data: row, error: fetchErr } = await supabase
    .from("doctor_specialty_change_requests")
    .select(
      "id, doctor_id, from_specialty, to_specialty, to_specialty_from_master, license_number, status",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (fetchErr) {
    if (isSupabaseMissingTableError(fetchErr)) {
      return NextResponse.json(
        { message: "Specialty change requests table is missing." },
        { status: 503 },
      );
    }
    console.error("[specialty-change-review] fetch failed", fetchErr);
    return NextResponse.json({ message: "Could not load request." }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ message: "Request not found." }, { status: 404 });
  }

  if (String((row as { status?: string }).status ?? "") !== "pending") {
    return NextResponse.json(
      { message: "This request has already been resolved." },
      { status: 400 },
    );
  }

  const founderNote = normalizeFounderNote(body.founderNote);
  const nowIso = new Date().toISOString();

  if (action === "reject") {
    const { error: rejectErr } = await supabase
      .from("doctor_specialty_change_requests")
      .update({
        status: "rejected",
        resolved_at: nowIso,
        founder_note: founderNote,
      })
      .eq("id", requestId)
      .eq("status", "pending");

    if (rejectErr) {
      console.error("[specialty-change-review] reject failed", rejectErr);
      return NextResponse.json({ message: "Could not reject request." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  const fromMasterFlag =
    body.toSpecialtyFromMaster === undefined || body.toSpecialtyFromMaster === null
      ? Boolean((row as { to_specialty_from_master?: boolean }).to_specialty_from_master)
      : body.toSpecialtyFromMaster === true ||
        body.toSpecialtyFromMaster === "true" ||
        body.toSpecialtyFromMaster === 1 ||
        body.toSpecialtyFromMaster === "1";

  const toSpecialtyRaw =
    typeof body.toSpecialty === "string" && body.toSpecialty.trim()
      ? body.toSpecialty
      : String((row as { to_specialty?: string }).to_specialty ?? "");
  const licenseRaw =
    typeof body.licenseNumber === "string" && body.licenseNumber.trim()
      ? body.licenseNumber
      : String((row as { license_number?: string }).license_number ?? "");

  const validated = validateSpecialtyChangeRequestInput({
    toSpecialty: toSpecialtyRaw,
    toSpecialtyFromMaster: fromMasterFlag,
    licenseNumber: licenseRaw,
  });
  if (validated.ok === false) {
    return NextResponse.json({ message: validated.message }, { status: 400 });
  }

  // Prefer canonical master labels when the submitted text matches one.
  const finalSpecialty = isMasterSpecialty(validated.toSpecialty)
    ? validated.toSpecialty
    : validated.toSpecialty;
  const isApproved = isMasterSpecialty(finalSpecialty)
    ? true
    : validated.isSpecialtyApproved;

  const doctorId = (row as { doctor_id: string }).doctor_id;

  const { error: doctorErr } = await supabase
    .from("doctors")
    .update({
      specialty: finalSpecialty,
      license_number: validated.licenseNumber,
      is_specialty_approved: isApproved,
      specialty_requires_standard_at: null,
    })
    .eq("id", doctorId);

  if (doctorErr) {
    console.error("[specialty-change-review] doctor update failed", doctorErr);
    return NextResponse.json(
      { message: "Could not update professional specialty." },
      { status: 500 },
    );
  }

  const { error: approveErr } = await supabase
    .from("doctor_specialty_change_requests")
    .update({
      status: "approved",
      resolved_at: nowIso,
      founder_note: founderNote,
      to_specialty: finalSpecialty,
      to_specialty_from_master: isMasterSpecialty(finalSpecialty),
      license_number: validated.licenseNumber,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (approveErr) {
    console.error("[specialty-change-review] approve mark failed", approveErr);
    return NextResponse.json(
      { message: "Specialty was updated but the request status could not be saved." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    status: "approved",
    specialty: finalSpecialty,
    is_specialty_approved: isApproved,
  });
}
