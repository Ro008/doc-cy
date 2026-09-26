import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { requireAdminWrite } from "@/lib/admin-auth";
import { isSupabaseMissingTableError } from "@/lib/supabase-db-errors";
import {
  normalizeFounderNote,
  parseSpecialtyChangeRequestKind,
  validateSpecialtyChangeRequestInput,
} from "@/lib/doctor-specialty-change-request";
import { loadSpecialtyCatalogueNames } from "@/lib/specialty-catalogue";
import { isCatalogueSpecialty } from "@/lib/specialty-options";
import {
  deleteProfessionalSpecialty,
  upsertProfessionalSpecialty,
} from "@/lib/professional-specialty-writes";

type Body = {
  requestId?: string;
  action?: "approve" | "reject";
  /** Optional override when approving (typo fix / canonical label). */
  toSpecialty?: string;
  toSpecialtyFromMaster?: boolean | string | number;
  /** Optional override for the license number stored on the specialty row. */
  licenseNumber?: string;
  founderNote?: string;
};

/** POST — founder approves or rejects a specialty change request. */
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
    .from("professional_specialty_change_requests")
    .select(
      "id, professional_id, from_specialty, to_specialty, to_specialty_from_master, license_number, status, request_kind",
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
      .from("professional_specialty_change_requests")
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

  const doctorId = (row as { professional_id: string }).professional_id;
  const fromSpecialty = String(
    (row as { from_specialty?: string | null }).from_specialty ?? "",
  ).trim();
  const rowToSpecialty = String(
    (row as { to_specialty?: string | null }).to_specialty ?? "",
  ).trim();
  const requestKind =
    parseSpecialtyChangeRequestKind(
      (row as { request_kind?: string | null }).request_kind,
    ) ??
    (fromSpecialty && !rowToSpecialty
      ? "remove"
      : fromSpecialty
        ? "replace"
        : "add");

  if (requestKind === "remove") {
    if (!fromSpecialty) {
      return NextResponse.json(
        { message: "Remove request is missing the specialty to delete." },
        { status: 400 },
      );
    }
    const { count, error: countErr } = await supabase
      .from("professional_specialties")
      .select("id", { head: true, count: "exact" })
      .eq("professional_id", doctorId);
    if (countErr) {
      console.error("[specialty-change-review] count failed", countErr);
      return NextResponse.json({ message: "Could not remove specialty." }, { status: 500 });
    }
    if ((count ?? 0) < 2) {
      return NextResponse.json(
        {
          message:
            "Cannot remove the only remaining specialty. Reject this request or ask the doctor to change it instead.",
        },
        { status: 400 },
      );
    }

    const { error: deleteErr } = await deleteProfessionalSpecialty(
      supabase,
      doctorId,
      fromSpecialty,
    );
    if (deleteErr) {
      console.error("[specialty-change-review] remove delete failed", deleteErr);
      return NextResponse.json({ message: "Could not remove specialty." }, { status: 500 });
    }

    const { error: approveErr } = await supabase
      .from("professional_specialty_change_requests")
      .update({
        status: "approved",
        resolved_at: nowIso,
        founder_note: founderNote,
      })
      .eq("id", requestId)
      .eq("status", "pending");

    if (approveErr) {
      console.error("[specialty-change-review] remove approve mark failed", approveErr);
      return NextResponse.json(
        { message: "Specialty was removed but the request status could not be saved." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      status: "approved",
      requestKind: "remove",
      removedSpecialty: fromSpecialty,
    });
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

  const catalogue = await loadSpecialtyCatalogueNames(supabase);
  const validated = validateSpecialtyChangeRequestInput(
    {
      toSpecialty: toSpecialtyRaw,
      toSpecialtyFromMaster: fromMasterFlag,
      licenseNumber: licenseRaw,
    },
    catalogue,
  );
  if (validated.ok === false) {
    return NextResponse.json({ message: validated.message }, { status: 400 });
  }

  const finalSpecialty = validated.toSpecialty;
  const isApproved = isCatalogueSpecialty(catalogue, finalSpecialty)
    ? true
    : validated.isSpecialtyApproved;

  if (requestKind === "replace" && fromSpecialty) {
    const { error: deleteErr } = await deleteProfessionalSpecialty(
      supabase,
      doctorId,
      fromSpecialty,
    );
    if (deleteErr) {
      console.error("[specialty-change-review] replace delete failed", deleteErr);
      return NextResponse.json(
        { message: "Could not replace the previous specialty." },
        { status: 500 },
      );
    }
  }

  const { error: specialtyRowErr } = await upsertProfessionalSpecialty(supabase, {
    professionalId: doctorId,
    specialty: finalSpecialty,
    licenseNumber: validated.licenseNumber,
    isApproved,
  });
  if (specialtyRowErr) {
    console.error("[specialty-change-review] professional_specialties write failed", specialtyRowErr);
    return NextResponse.json(
      { message: "Could not update professional specialty." },
      { status: 500 },
    );
  }

  const { error: approveErr } = await supabase
    .from("professional_specialty_change_requests")
    .update({
      status: "approved",
      resolved_at: nowIso,
      founder_note: founderNote,
      to_specialty: finalSpecialty,
      to_specialty_from_master: isCatalogueSpecialty(catalogue, finalSpecialty),
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
    requestKind,
    specialty: finalSpecialty,
    is_specialty_approved: isApproved,
  });
}
