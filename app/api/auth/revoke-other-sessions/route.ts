import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { parseAuthTokenClaims } from "@/lib/auth-token-claims";

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user, session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !user || !session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const claims = parseAuthTokenClaims(session.access_token);
  if (!claims.sessionId) {
    return NextResponse.json(
      { message: "Could not read current session identifier." },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("doctors")
    .update({
      auth_session_revoked_after: nowIso,
      auth_keep_session_id: claims.sessionId,
    })
    .eq("auth_user_id", user.id);

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "42703") {
      return NextResponse.json(
        {
          message:
            "Database migration required. Run supabase/doctors_auth_session_revocation.sql.",
        },
        { status: 500 }
      );
    }
    console.error("[DocCy][auth] revoke_other_sessions_failed", error);
    return NextResponse.json(
      { message: "Could not revoke other sessions." },
      { status: 500 }
    );
  }

  console.info("[DocCy][auth] revoke_other_sessions_success", {
    userId: user.id,
    keepSessionId: claims.sessionId,
    revokedAfter: nowIso,
  });

  return NextResponse.json({ ok: true });
}

