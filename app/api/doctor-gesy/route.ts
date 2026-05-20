import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const b = body as { isGesy?: unknown };
  const nextValue =
    typeof b.isGesy === "boolean" ? b.isGesy : undefined;

  if (nextValue === undefined) {
    return NextResponse.json(
      { message: "Missing isGesy boolean." },
      { status: 400 },
    );
  }

  const { data: doctor, error: doctorErr } = await supabase
    .from("doctors")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorErr) {
    return NextResponse.json(
      { message: "Error fetching professional." },
      { status: 500 },
    );
  }
  if (!doctor) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { error: updateErr } = await supabase
    .from("doctors")
    .update({ is_gesy: nextValue })
    .eq("id", doctor.id);

  if (updateErr) {
    const msg = String(updateErr.message ?? "");
    if (updateErr.code === "42703" || /is_gesy/i.test(msg)) {
      return NextResponse.json(
        {
          message:
            "Database migration required for GESY settings. Run the latest Supabase migrations, then try again.",
        },
        { status: 500 },
      );
    }
    console.error("[DocCy] Failed to update is_gesy", updateErr);
    return NextResponse.json(
      { message: "Error updating GESY setting." },
      { status: 500 },
    );
  }

  return NextResponse.json({ isGesy: nextValue }, { status: 200 });
}
