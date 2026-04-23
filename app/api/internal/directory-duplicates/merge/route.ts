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
    .select("id, manual_id, status")
    .eq("id", suggestionId)
    .maybeSingle();

  if (suggestionErr) {
    console.error("[directory-duplicates/merge] load failed", suggestionErr);
    return NextResponse.json({ message: "Could not load suggestion." }, { status: 500 });
  }
  if (!suggestion) {
    return NextResponse.json({ message: "Suggestion not found." }, { status: 404 });
  }

  const manualId = (suggestion as { manual_id?: string | null }).manual_id;
  if (!manualId) {
    return NextResponse.json({ message: "Manual entry missing in suggestion." }, { status: 400 });
  }

  const { error: archiveErr } = await supabase
    .from("directory_manual")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", manualId);
  if (archiveErr) {
    console.error("[directory-duplicates/merge] archive manual failed", archiveErr);
    return NextResponse.json({ message: "Could not archive manual entry." }, { status: 500 });
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
    .eq("manual_id", manualId)
    .eq("status", "pending");

  return NextResponse.json({ ok: true });
}
