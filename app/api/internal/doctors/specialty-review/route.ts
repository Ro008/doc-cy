import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isInternalDirectoryAuthenticated } from "@/lib/internal-directory-auth";
import { isMasterSpecialty } from "@/lib/cyprus-specialties";
import { normalizeApprovedCustomSpecialty } from "@/lib/specialty-submission";

type Body = {
  doctorId?: string;
  action?: "approve" | "map";
  /** Required when action is map — must be a canonical master specialty */
  mapTo?: string;
};

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

  if (!doctorId || (action !== "approve" && action !== "map")) {
    return NextResponse.json(
      { message: "doctorId and action (approve | map) are required." },
      { status: 400 }
    );
  }

  if (action === "map") {
    const mapTo = typeof body.mapTo === "string" ? body.mapTo.trim() : "";
    if (!mapTo || !isMasterSpecialty(mapTo)) {
      return NextResponse.json(
        { message: "mapTo must be a standard specialty from the master list." },
        { status: 400 }
      );
    }
    const { error } = await supabase
      .from("doctors")
      .update({
        specialty: mapTo,
        is_specialty_approved: true,
      })
      .eq("id", doctorId);

    if (error) {
      console.error("[specialty-review] map failed", error);
      return NextResponse.json({ message: "Update failed." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, specialty: mapTo, is_specialty_approved: true });
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
    String((row as { specialty?: string | null }).specialty ?? "")
  );
  if (!normalized) {
    return NextResponse.json(
      { message: "Professional has no specialty text to approve." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("doctors")
    .update({
      specialty: normalized,
      is_specialty_approved: true,
    })
    .eq("id", doctorId);

  if (error) {
    console.error("[specialty-review] approve failed", error);
    return NextResponse.json({ message: "Update failed." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    specialty: normalized,
    is_specialty_approved: true,
  });
}
