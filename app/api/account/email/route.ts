import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { cancelEmailChange, startEmailChange } from "@/lib/account-email-change-server";
import { resolvePasswordResetOrigin } from "@/lib/password-reset";
import { consumePublicApiRateLimit, isPublicApiRateLimitDisabled } from "@/lib/public-api-rate-limit";
import { validateNewEmail } from "@/lib/settings-account";
import { createServiceRoleClient } from "@/lib/supabase-service";

const HOUR_MS = 60 * 60 * 1000;
/** Confirmation emails she can ask for in an hour. */
const START_LIMIT = 5;

async function signedInProfessional() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ message: "Unauthorized." }, { status: 401 }) };
  const { data: pro } = await supabase.from("professionals").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!pro?.id) return { response: NextResponse.json({ message: "Forbidden." }, { status: 403 }) };
  return { user, professionalId: String(pro.id) };
}

/**
 * Settings → Account → "Change email" (user, 2026-10-11). A link goes to the new
 * address; nothing changes until it is opened and confirmed
 * (POST /api/account/email-confirmation). Behind the emailed sign-in step (middleware).
 * - 200 { email } · 400 not usable · 401 signed out · 403 not a professional ·
 *   409 another account uses it · 429 too many tries · 502 the email could not be sent
 */
export async function POST(req: Request) {
  const who = await signedInProfessional();
  if ("response" in who) return who.response;

  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = String(body?.email ?? "").trim();
  const invalid = validateNewEmail(who.user.email ?? "", email);
  if (invalid) return NextResponse.json({ message: invalid }, { status: 400 });

  const siteUrl = resolvePasswordResetOrigin(req);
  if (!siteUrl) return NextResponse.json({ message: "Invalid origin." }, { status: 400 });

  if (!isPublicApiRateLimitDisabled()) {
    const limit = consumePublicApiRateLimit({
      bucket: "emailChangeStart",
      key: who.professionalId,
      limit: START_LIMIT,
      windowMs: HOUR_MS,
    });
    if (!limit.ok) return NextResponse.json({ message: "Too many tries." }, { status: 429 });
  }

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const result = await startEmailChange(service, { professionalId: who.professionalId, newEmail: email, siteUrl });
  if (result.status !== 200) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ email: email.toLowerCase() });
}

/** Cancel the change that is waiting: its link stops working. 200 either way. */
export async function DELETE() {
  const who = await signedInProfessional();
  if ("response" in who) return who.response;

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const result = await cancelEmailChange(service, who.professionalId);
  if (result.status !== 200) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ ok: true });
}
