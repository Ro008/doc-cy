import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { persistLocalTestLoginPassword, shouldPersistLocalTestLoginPassword } from "@/lib/local-test-login-credentials";
import { PASSWORD_RESET_MIN_LENGTH } from "@/lib/password-reset";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Local/dev only: keep the founder-directory plaintext password in sync after a reset.
 * No-op in production (Auth hashes are not recoverable).
 */
export async function POST(req: Request) {
  if (!shouldPersistLocalTestLoginPassword()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  }

  let body: { password?: unknown };
  try {
    body = (await req.json()) as { password?: unknown };
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  const password = String(body.password ?? "");
  if (password.length < PASSWORD_RESET_MIN_LENGTH || password.length > 200) {
    return NextResponse.json({ ok: false, reason: "invalid_password" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ ok: false, reason: "service_role_not_configured" }, { status: 503 });
  }

  await persistLocalTestLoginPassword(admin, user.id, password);
  return NextResponse.json({ ok: true });
}
