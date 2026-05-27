import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isInternalDirectoryAuthenticated } from "@/lib/internal-directory-auth";
import { isMasterSpecialty } from "@/lib/cyprus-specialties";
import { normalizeApprovedCustomSpecialty } from "@/lib/specialty-submission";
import { sendDoctorSpecialtyRequireStandardEmail } from "@/lib/send-doctor-specialty-require-standard-email";

type Body = {
  doctorId?: string;
  action?: "map" | "approve_new" | "approve_edited" | "require_standard";
  /** Required when action is map — must be a canonical master specialty */
  mapTo?: string;
  /** Required when action is approve_edited */
  editedSpecialty?: string;
  /** Optional note included in the email when action is require_standard */
  message?: string;
};

const MESSAGE_MAX = 2000;

function clearRequiresStandard() {
  return { specialty_requires_standard_at: null };
}

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

  const doctorId = typeof body.doctorId === "string" ? body.doctorId.trim() : "";
  const action = body.action;

  if (
    !doctorId ||
    (action !== "map" &&
      action !== "approve_new" &&
      action !== "approve_edited" &&
      action !== "require_standard")
  ) {
    return NextResponse.json(
      {
        message:
          "doctorId and action (map | approve_new | approve_edited | require_standard) are required.",
      },
      { status: 400 },
    );
  }

  if (action === "require_standard") {
    const messageRaw =
      typeof body.message === "string" ? body.message.trim() : "";
    if (messageRaw.length > MESSAGE_MAX) {
      return NextResponse.json(
        { message: "Message is too long." },
        { status: 400 },
      );
    }

    const { data: row, error: fetchErr } = await supabase
      .from("doctors")
      .select("id, name, email, specialty, is_specialty_approved")
      .eq("id", doctorId)
      .maybeSingle();

    if (fetchErr || !row) {
      return NextResponse.json({ message: "Professional not found." }, { status: 404 });
    }

    if ((row as { is_specialty_approved?: boolean }).is_specialty_approved) {
      return NextResponse.json(
        { message: "This specialty is already approved." },
        { status: 400 },
      );
    }

    const submitted = String(
      (row as { specialty?: string | null }).specialty ?? "",
    ).trim();
    if (!submitted) {
      return NextResponse.json(
        { message: "Professional has no specialty text on file." },
        { status: 400 },
      );
    }

    if (isMasterSpecialty(submitted)) {
      return NextResponse.json(
        {
          message:
            "This is already a standard specialty. Use Map to existing if you need to change it.",
        },
        { status: 400 },
      );
    }

    const { error: updateErr } = await supabase
      .from("doctors")
      .update({
        is_specialty_approved: false,
        specialty_requires_standard_at: new Date().toISOString(),
      })
      .eq("id", doctorId);

    if (updateErr) {
      console.error("[specialty-review] require_standard failed", updateErr);
      return NextResponse.json({ message: "Update failed." }, { status: 500 });
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
    const resendToOverride =
      process.env.NODE_ENV !== "production"
        ? process.env.RESEND_TO_OVERRIDE?.trim() || null
        : null;

    try {
      await sendDoctorSpecialtyRequireStandardEmail({
        siteUrl,
        doctorEmail: String((row as { email?: string | null }).email ?? ""),
        doctorName: String((row as { name?: string | null }).name ?? "there"),
        submittedSpecialty: submitted,
        founderMessage: messageRaw || null,
        resendToOverride,
      });
    } catch (e) {
      console.error("[specialty-review] require_standard email failed", e);
    }

    return NextResponse.json({
      ok: true,
      is_specialty_approved: false,
      specialty_requires_standard_at: true,
    });
  }

  if (action === "map") {
    const mapTo = typeof body.mapTo === "string" ? body.mapTo.trim() : "";
    if (!mapTo || !isMasterSpecialty(mapTo)) {
      return NextResponse.json(
        { message: "mapTo must be a standard specialty from the master list." },
        { status: 400 },
      );
    }
    const { error } = await supabase
      .from("doctors")
      .update({
        specialty: mapTo,
        is_specialty_approved: true,
        ...clearRequiresStandard(),
      })
      .eq("id", doctorId);

    if (error) {
      console.error("[specialty-review] map failed", error);
      return NextResponse.json({ message: "Update failed." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, specialty: mapTo, is_specialty_approved: true });
  }

  if (action === "approve_edited") {
    const editedRaw = typeof body.editedSpecialty === "string" ? body.editedSpecialty : "";
    const normalized = normalizeApprovedCustomSpecialty(editedRaw);
    if (!normalized) {
      return NextResponse.json({ message: "editedSpecialty is required." }, { status: 400 });
    }
    if (normalized.length > 120) {
      return NextResponse.json(
        { message: "Custom specialty must be 120 characters or less." },
        { status: 400 },
      );
    }
    if (isMasterSpecialty(normalized)) {
      return NextResponse.json(
        {
          message:
            "This matches a standard specialty. Use 'Map to existing' for canonical categories.",
        },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("doctors")
      .update({
        specialty: normalized,
        is_specialty_approved: true,
        ...clearRequiresStandard(),
      })
      .eq("id", doctorId);

    if (error) {
      console.error("[specialty-review] approve_edited failed", error);
      return NextResponse.json({ message: "Update failed." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      specialty: normalized,
      is_specialty_approved: true,
    });
  }

  const { data: row, error: fetchErr } = await supabase
    .from("doctors")
    .select("specialty")
    .eq("id", doctorId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ message: "Professional not found." }, { status: 404 });
  }

  const normalized = normalizeApprovedCustomSpecialty(
    String((row as { specialty?: string | null }).specialty ?? ""),
  );
  if (!normalized) {
    return NextResponse.json(
      { message: "Professional has no specialty text to approve." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("doctors")
    .update({
      specialty: normalized,
      is_specialty_approved: true,
      ...clearRequiresStandard(),
    })
    .eq("id", doctorId);

  if (error) {
    console.error("[specialty-review] approve_new failed", error);
    return NextResponse.json({ message: "Update failed." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    specialty: normalized,
    is_specialty_approved: true,
  });
}
