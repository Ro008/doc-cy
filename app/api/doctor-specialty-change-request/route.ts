import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isSupabaseMissingTableError } from "@/lib/supabase-db-errors";
import {
  parseSpecialtyChangeRequestKind,
  validateSpecialtyChangeAgainstProfile,
  validateSpecialtyChangeRequestInput,
} from "@/lib/doctor-specialty-change-request";
import { publicSpecialtyLabels } from "@/lib/doctor-specialties";

type Body = {
  requestKind?: string;
  fromSpecialty?: string;
  toSpecialty?: string;
  toSpecialtyFromMaster?: boolean | string | number;
  licenseNumber?: string;
};

/** POST — authenticated doctor submits add / replace / remove specialty request. */
export async function POST(req: NextRequest) {
  const supabaseAuth = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ message: "Server not configured." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 });
  }

  const requestKind = parseSpecialtyChangeRequestKind(body.requestKind);
  if (!requestKind) {
    return NextResponse.json(
      { message: "Choose whether to add, change, or remove a specialty." },
      { status: 400 },
    );
  }

  const fromMaster =
    body.toSpecialtyFromMaster === true ||
    body.toSpecialtyFromMaster === "true" ||
    body.toSpecialtyFromMaster === 1 ||
    body.toSpecialtyFromMaster === "1";

  let toSpecialty = "";
  let toSpecialtyFromMaster = true;
  let isSpecialtyApproved = true;
  let licenseNumber: string | null = null;

  if (requestKind !== "remove") {
    const validated = validateSpecialtyChangeRequestInput({
      toSpecialty: typeof body.toSpecialty === "string" ? body.toSpecialty : "",
      toSpecialtyFromMaster: fromMaster,
      licenseNumber: typeof body.licenseNumber === "string" ? body.licenseNumber : "",
    });
    if (validated.ok === false) {
      return NextResponse.json({ message: validated.message }, { status: 400 });
    }
    toSpecialty = validated.toSpecialty;
    toSpecialtyFromMaster = validated.toSpecialtyFromMaster;
    isSpecialtyApproved = validated.isSpecialtyApproved;
    licenseNumber = validated.licenseNumber;
  }

  const { data: doctor, error: doctorErr } = await admin
    .from("doctors")
    .select("id, specialty, specialties, is_specialty_approved")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorErr || !doctor) {
    return NextResponse.json({ message: "Professional profile not found." }, { status: 404 });
  }

  const doctorId = doctor.id as string;
  const existingLabels = publicSpecialtyLabels({
    specialties: (doctor as { specialties?: string[] | null }).specialties,
    specialty: (doctor as { specialty?: string | null }).specialty,
    is_specialty_approved: true,
  });
  const rawLabels = Array.isArray((doctor as { specialties?: string[] | null }).specialties)
    ? ((doctor as { specialties?: string[] }).specialties ?? [])
        .map((s) => String(s ?? "").trim())
        .filter(Boolean)
    : [];
  const labelsForMatch =
    rawLabels.length > 0
      ? rawLabels
      : [String((doctor as { specialty?: string | null }).specialty ?? "").trim()].filter(
          Boolean,
        );

  const profileCheck = validateSpecialtyChangeAgainstProfile({
    kind: requestKind,
    fromSpecialty: typeof body.fromSpecialty === "string" ? body.fromSpecialty : "",
    toSpecialty: requestKind === "remove" ? "" : toSpecialty,
    existingLabels: labelsForMatch.length > 0 ? labelsForMatch : existingLabels,
  });
  if (profileCheck.ok === false) {
    return NextResponse.json({ message: profileCheck.message }, { status: 400 });
  }

  const { data: existingPending, error: pendingErr } = await admin
    .from("doctor_specialty_change_requests")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingErr && !isSupabaseMissingTableError(pendingErr)) {
    console.error("[specialty-change] pending check failed", pendingErr);
    return NextResponse.json({ message: "Could not submit request." }, { status: 500 });
  }
  if (pendingErr && isSupabaseMissingTableError(pendingErr)) {
    return NextResponse.json(
      {
        message:
          "Specialty change requests are not available yet. Please try again after the next database update.",
      },
      { status: 503 },
    );
  }
  if (existingPending) {
    return NextResponse.json(
      {
        message:
          "You already have a specialty request pending review. We will update your profile once it is approved.",
      },
      { status: 409 },
    );
  }

  const insertPayload: Record<string, unknown> = {
    doctor_id: doctorId,
    from_specialty: profileCheck.fromSpecialty,
    to_specialty: requestKind === "remove" ? null : toSpecialty,
    to_specialty_from_master:
      requestKind === "remove" ? true : toSpecialtyFromMaster,
    license_number: requestKind === "remove" ? null : licenseNumber,
    status: "pending",
    request_kind: requestKind,
  };
  // Silence unused — kept for future founder display of custom approval flag.
  void isSpecialtyApproved;

  const { data: inserted, error: insertErr } = await admin
    .from("doctor_specialty_change_requests")
    .insert(insertPayload)
    .select("id, created_at")
    .single();

  if (insertErr) {
    if (isSupabaseMissingTableError(insertErr)) {
      return NextResponse.json(
        {
          message:
            "Specialty change requests are not available yet. Please try again after the next database update.",
        },
        { status: 503 },
      );
    }
    if (insertErr.code === "23505") {
      return NextResponse.json(
        {
          message:
            "You already have a specialty request pending review. We will update your profile once it is approved.",
        },
        { status: 409 },
      );
    }
    console.error("[specialty-change] insert failed", insertErr);
    return NextResponse.json({ message: "Could not submit request." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    requestId: inserted?.id,
    createdAt: inserted?.created_at,
    requestKind,
  });
}
