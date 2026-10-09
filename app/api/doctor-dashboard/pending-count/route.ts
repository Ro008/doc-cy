import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { countPendingRequests } from "@/lib/pending-requests-count";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { data: doctor } = await supabase
    .from("professionals")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!doctor?.id) {
    return NextResponse.json({ count: 0 }, { headers: { "Cache-Control": "no-store" } });
  }

  const count = await countPendingRequests(supabase, doctor.id);
  if (count === null) {
    return NextResponse.json({ message: "Could not load requests." }, { status: 500 });
  }
  return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
