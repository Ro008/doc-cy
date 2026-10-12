import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { buildPasswordChangedNoticeEmail, sendAccountSecurityEmail } from "@/lib/account-security-emails";
import { resolvePasswordResetOrigin } from "@/lib/password-reset";
import { consumePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { revokeOtherSessions } from "@/lib/revoke-other-sessions";

/**
 * Called by the "Choose a new password" page once the password is saved (user,
 * 2026-10-11): her other devices are signed out, and she is told by email, so a
 * password she did not change is noticed.
 * - 200 { ok, othersSignedOut } · 401 signed out
 */
export async function POST(req: Request) {
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
  if (!revoked.ok) console.error("[DocCy][auth] password_changed_revoke_failed", revoked);

  // At most three notices an hour: this route can be called by any signed-in session.
  const notice = consumePublicApiRateLimit({
    bucket: "passwordChangedNotice",
    key: user.id,
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (notice.ok && user.email) {
    const siteUrl = resolvePasswordResetOrigin(req) ?? "https://www.mydoccy.com";
    await sendAccountSecurityEmail(user.email, buildPasswordChangedNoticeEmail({ siteUrl }));
  }

  return NextResponse.json({ ok: true, othersSignedOut: revoked.ok });
}
