import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isSupabaseMissingTableError } from "@/lib/supabase-db-errors";
import { validateSpecialtyChangeRequestInput } from "@/lib/doctor-specialty-change-request";

type Body = {
  toSpecialty?: string;
  toSpecialtyFromMaster?: boolean | string | number;
  licenseNumber?: string;
};

/** POST — authenticated doctor submits a specialty change request (settings). */
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

  const fromMaster =
    body.toSpecialtyFromMaster === true ||
    body.toSpecialtyFromMaster === "true" ||
    body.toSpecialtyFromMaster === 1 ||
    body.toSpecialtyFromMaster === "1";

  const validated = validateSpecialtyChangeRequestInput({
    toSpecialty: typeof body.toSpecialty === "string" ? body.toSpecialty : "",
    toSpecialtyFromMaster: fromMaster,
    licenseNumber: typeof body.licenseNumber === "string" ? body.licenseNumber : "",
  });
  if (validated.ok === false) {
    return NextResponse.json({ message: validated.message }, { status: 400 });
  }

  const { data: doctor, error: doctorErr } = await admin
    .from("doctors")
    .select("id, specialty")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorErr || !doctor) {
    return NextResponse.json({ message: "Professional profile not found." }, { status: 404 });
  }

  const doctorId = doctor.id as string;
  const fromSpecialty = String(
    (doctor as { specialty?: string | null }).specialty ?? "",
  ).trim();

  if (!fromSpecialty) {
    return NextResponse.json(
      { message: "Your current specialty is missing. Contact Support." },
      { status: 400 },
    );
  }

  if (validated.toSpecialty === fromSpecialty) {
    return NextResponse.json(
      { message: "Requested specialty is the same as your current specialty." },
      { status: 400 },
    );
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
          "You already have a specialty change request pending review. We will update your profile once it is approved.",
      },
      { status: 409 },
    );
  }

  const { data: inserted, error: insertErr } = await admin
    .from("doctor_specialty_change_requests")
    .insert({
      doctor_id: doctorId,
      from_specialty: fromSpecialty,
      to_specialty: validated.toSpecialty,
      to_specialty_from_master: validated.toSpecialtyFromMaster,
      license_number: validated.licenseNumber,
      status: "pending",
    })
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
    // Unique pending index race
    if (insertErr.code === "23505") {
      return NextResponse.json(
        {
          message:
            "You already have a specialty change request pending review. We will update your profile once it is approved.",
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
  });
}
