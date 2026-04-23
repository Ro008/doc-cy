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

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("directory_duplicate_suggestions")
    .update({ status: "dismissed", resolved_at: now, updated_at: now })
    .eq("id", suggestionId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[directory-duplicates/dismiss] update failed", error);
    return NextResponse.json({ message: "Could not dismiss suggestion." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ message: "Suggestion not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
