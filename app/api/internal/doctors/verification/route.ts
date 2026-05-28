import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isInternalDirectoryAuthenticated } from "@/lib/internal-directory-auth";
import { verificationBlockedReason } from "@/lib/doctor-specialty-public";

type Body = {
  doctorId?: string;
  action?: "verify" | "reject";
};

export async function POST(req: NextRequest) {
  if (!isInternalDirectoryAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json(
      { message: "Server is not configured for internal tools." },
      { status: 503 }
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

  if (!doctorId || (action !== "verify" && action !== "reject")) {
    return NextResponse.json(
      { message: "doctorId and action (verify | reject) are required." },
      { status: 400 }
    );
  }

  if (action === "verify") {
    const { data: row, error: fetchErr } = await supabase
      .from("doctors")
      .select("id, is_specialty_approved, specialty_requires_standard_at")
      .eq("id", doctorId)
      .maybeSingle();

    if (fetchErr || !row) {
      return NextResponse.json({ message: "Professional not found." }, { status: 404 });
    }

    const blockReason = verificationBlockedReason({
      is_specialty_approved: (row as { is_specialty_approved?: boolean | null })
        .is_specialty_approved,
      specialty_requires_standard_at: (
        row as { specialty_requires_standard_at?: string | null }
      ).specialty_requires_standard_at,
    });
    if (blockReason) {
      return NextResponse.json({ message: blockReason }, { status: 400 });
    }
  }

  const status = action === "verify" ? "verified" : "rejected";

  const { data: updated, error } = await supabase
    .from("doctors")
    .update({ status })
    .eq("id", doctorId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[internal/doctors/verification] update failed", error);
    return NextResponse.json(
      { message: "Could not update professional status." },
      { status: 500 }
    );
  }

  if (!updated) {
    return NextResponse.json({ message: "Professional not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, status });
}
