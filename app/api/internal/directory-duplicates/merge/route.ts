import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isInternalDirectoryAuthenticated } from "@/lib/internal-directory-auth";

type Body = { suggestionId?: string };

export async function POST(req: NextRequest) {
  if (!isInternalDirectoryAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

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

  const suggestionId = String(body.suggestionId ?? "").trim();
  if (!suggestionId) {
    return NextResponse.json({ message: "suggestionId is required." }, { status: 400 });
  }

  const { data: suggestion, error: suggestionErr } = await supabase
    .from("directory_duplicate_suggestions")
    .select("id, manual_id, doctor_id, status")
    .eq("id", suggestionId)
    .maybeSingle();

  if (suggestionErr) {
    console.error("[directory-duplicates/merge] load failed", suggestionErr);
    return NextResponse.json({ message: "Could not load suggestion." }, { status: 500 });
  }
  if (!suggestion) {
    return NextResponse.json({ message: "Suggestion not found." }, { status: 404 });
  }

  const unregisteredId = String(
    (suggestion as { manual_id?: string | null }).manual_id ?? "",
  ).trim();
  const registeredId = String(
    (suggestion as { doctor_id?: string | null }).doctor_id ?? "",
  ).trim();
  if (!unregisteredId || !registeredId) {
    return NextResponse.json({ message: "Suggestion is missing professional ids." }, { status: 400 });
  }

  const { error: absorbErr } = await supabase.rpc("absorb_unregistered_into_registered", {
    p_registered_id: registeredId,
    p_unregistered_id: unregisteredId,
  });
  if (absorbErr) {
    console.error("[directory-duplicates/merge] absorb failed", absorbErr);
    return NextResponse.json({ message: "Could not merge directory listing." }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("directory_duplicate_suggestions")
    .update({ status: "merged", resolved_at: now, updated_at: now })
    .eq("id", suggestionId);
  if (updateErr) {
    console.error("[directory-duplicates/merge] update suggestion failed", updateErr);
    return NextResponse.json({ message: "Could not update suggestion." }, { status: 500 });
  }

  // Mark sibling suggestions for the same manual row as dismissed, so they disappear from queue.
  await supabase
    .from("directory_duplicate_suggestions")
    .update({ status: "dismissed", resolved_at: now, updated_at: now })
    .eq("manual_id", unregisteredId)
    .eq("status", "pending");

  return NextResponse.json({ ok: true });
}
