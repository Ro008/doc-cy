import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { revokeOtherSessions } from "@/lib/revoke-other-sessions";

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user || !session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const revoked = await revokeOtherSessions(supabase, { userId: user.id, accessToken: session.access_token });
  if (!revoked.ok) {
    if (revoked.code === "42703") {
      return NextResponse.json(
        {
          message:
            "Signing out other sessions is unavailable because the database is missing a column. Please contact DocCy support.",
        },
        { status: 500 }
      );
    }
    if (revoked.status === 500) console.error("[DocCy][auth] revoke_other_sessions_failed", revoked);
    return NextResponse.json({ message: revoked.message }, { status: revoked.status });
  }

  console.info("[DocCy][auth] revoke_other_sessions_success", {
    userId: user.id,
    keepSessionId: revoked.sessionId,
    revokedAfter: revoked.revokedAfter,
  });

  return NextResponse.json({ ok: true });
}

