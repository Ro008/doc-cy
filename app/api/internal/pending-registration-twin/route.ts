import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { denyUnlessInternalFounder } from "@/lib/internal-directory-auth";

type Body = {
  registeredId?: string;
  unregisteredId?: string;
  action?: "absorb" | "keep_both";
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const denied = denyUnlessInternalFounder();
  if (denied) return denied;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Server is not configured." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 });
  }

  const registeredId = String(body.registeredId ?? "").trim();
  const unregisteredId = String(body.unregisteredId ?? "").trim();
  const action = body.action === "keep_both" ? "keep_both" : "absorb";

  if (!UUID_RE.test(registeredId) || !UUID_RE.test(unregisteredId)) {
    return NextResponse.json(
      { message: "registeredId and unregisteredId are required." },
      { status: 400 },
    );
  }
  if (registeredId === unregisteredId) {
    return NextResponse.json({ message: "Ids must differ." }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (action === "keep_both") {
    const { data: existing } = await supabase
      .from("directory_duplicate_suggestions")
      .select("id, status")
      .eq("manual_id", unregisteredId)
      .eq("doctor_id", registeredId)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from("directory_duplicate_suggestions")
        .update({ status: "dismissed", resolved_at: now, updated_at: now })
        .eq("id", existing.id);
      if (error) {
        console.error("[pending-twin] dismiss update failed", error);
        return NextResponse.json({ message: "Could not keep both." }, { status: 500 });
      }
    } else {
      const { error } = await supabase.from("directory_duplicate_suggestions").insert({
        manual_id: unregisteredId,
        doctor_id: registeredId,
        score: 0,
        reason: "Founder keep both from pending twin review",
        status: "dismissed",
        resolved_at: now,
      });
      if (error) {
        console.error("[pending-twin] dismiss insert failed", error);
        return NextResponse.json({ message: "Could not keep both." }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true, action: "keep_both" });
  }

  const { error: absorbErr } = await supabase.rpc("absorb_unregistered_into_registered", {
    p_registered_id: registeredId,
    p_unregistered_id: unregisteredId,
  });
  if (absorbErr) {
    console.error("[pending-twin] absorb failed", absorbErr);
    return NextResponse.json({ message: "Could not absorb listing." }, { status: 500 });
  }

  await supabase
    .from("directory_duplicate_suggestions")
    .update({ status: "merged", resolved_at: now, updated_at: now })
    .eq("manual_id", unregisteredId)
    .eq("doctor_id", registeredId);

  await supabase
    .from("directory_duplicate_suggestions")
    .update({ status: "dismissed", resolved_at: now, updated_at: now })
    .eq("manual_id", unregisteredId)
    .eq("status", "pending");

  return NextResponse.json({ ok: true, action: "absorb" });
}
