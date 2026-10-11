import type { SupabaseClient } from "@supabase/supabase-js";

import { parseAuthTokenClaims } from "@/lib/auth-token-claims";

export type RevokeOtherSessionsResult = {
  ok: boolean;
  /** HTTP status to answer with when it failed. */
  status: number;
  message: string;
  /** Postgres error code, when the database refused. */
  code?: string;
  sessionId?: string;
  revokedAfter?: string;
};

/**
 * Sign her out everywhere but here: sessions issued before now stop working, except
 * the one this request came from (the middleware reads the two columns). `supabase` is
 * her session client; she may write these two columns of her own row.
 */
export async function revokeOtherSessions(
  supabase: SupabaseClient,
  input: { userId: string; accessToken: string },
): Promise<RevokeOtherSessionsResult> {
  const claims = parseAuthTokenClaims(input.accessToken);
  if (!claims.sessionId) {
    return { ok: false, status: 400, message: "Could not read current session identifier." };
  }

  const revokedAfter = new Date().toISOString();
  const { error } = await supabase
    .from("professionals")
    .update({ auth_session_revoked_after: revokedAfter, auth_keep_session_id: claims.sessionId })
    .eq("auth_user_id", input.userId);
  if (error) {
    return {
      ok: false,
      status: 500,
      message: "Could not revoke other sessions.",
      code: (error as { code?: string }).code,
    };
  }
  return { ok: true, status: 200, message: "", sessionId: claims.sessionId, revokedAfter };
}
