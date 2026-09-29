import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { safeAuthNextPath } from "@/lib/auth-redirect";
import { resolvePasswordResetOrigin } from "@/lib/password-reset";
import { signInLinkPath } from "@/lib/professional-email-step";
import {
  consumePublicApiRateLimit,
  enforcePublicApiRateLimit,
  isPublicApiRateLimitDisabled,
} from "@/lib/public-api-rate-limit";
import { sendSignInLinkEmail } from "@/lib/send-sign-in-link-email";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Practitioner sign-in, first step (user, 2026-09-29).
 * - Checks the password without keeping that session.
 * - An approved professional (a `professionals` row) is emailed a one-time link and
 *   code (Supabase `generateLink`, 1 hour); only that creates her session.
 * - Anyone else with a login (an applicant, a founder) is signed in as before.
 */

const LINK_EMAIL_WINDOW_MS = 60 * 60 * 1000;
const LINK_EMAIL_LIMIT = 10;

type Body = { email?: unknown; password?: unknown; next?: unknown };

function passwordClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Not a Vercel deployment (a dev server, or CI's `npm run start`): no email service needed. */
function isOffVercel(): boolean {
  return !process.env.VERCEL;
}

export async function POST(req: Request) {
  const limited = enforcePublicApiRateLimit(req, "signIn");
  if (limited) return limited;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const next = safeAuthNextPath(typeof body.next === "string" ? body.next : null);
  if (!email || !password) {
    return NextResponse.json({ ok: false, reason: "invalid_credentials" }, { status: 400 });
  }

  const auth = passwordClient();
  const service = createServiceRoleClient();
  const origin = resolvePasswordResetOrigin(req);
  if (!auth || !service || !origin) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  const { data: signIn, error: signInError } = await auth.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session || !signIn.user) {
    const unconfirmed =
      signInError?.code === "email_not_confirmed" || /email not confirmed/i.test(signInError?.message ?? "");
    return NextResponse.json(
      { ok: false, reason: unconfirmed ? "email_not_confirmed" : "invalid_credentials" },
      { status: 401 },
    );
  }
  const session = signIn.session;

  const { data: professional, error: professionalError } = await service
    .from("professionals")
    .select("id")
    .eq("auth_user_id", signIn.user.id)
    .maybeSingle();
  if (professionalError) {
    await auth.auth.signOut({ scope: "local" });
    console.error("[DocCy][auth] sign_in_professional_lookup_failed", professionalError.message);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }

  if (!professional) {
    // Not an approved professional: signed in with the password, as before.
    const routeClient = createRouteHandlerClient({ cookies });
    const { error: setError } = await routeClient.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (setError) {
      console.error("[DocCy][auth] sign_in_set_session_failed", setError.message);
      return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, step: "signed_in" });
  }

  // The password alone gives her nothing: end that session now.
  await auth.auth.signOut({ scope: "local" });

  const loginEmail = String(signIn.user.email ?? email).trim();
  if (!isPublicApiRateLimitDisabled()) {
    const emailLimit = consumePublicApiRateLimit({
      bucket: "signInLinkEmail",
      key: loginEmail.toLowerCase(),
      limit: LINK_EMAIL_LIMIT,
      windowMs: LINK_EMAIL_WINDOW_MS,
    });
    if (!emailLimit.ok) {
      return NextResponse.json({ ok: false, reason: "too_many_emails" }, { status: 429 });
    }
  }

  const { data: link, error: linkError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: loginEmail,
  });
  const tokenHash = String(link?.properties?.hashed_token ?? "").trim();
  const code = String(link?.properties?.email_otp ?? "").trim();
  if (linkError || !tokenHash || !code) {
    console.error("[DocCy][auth] sign_in_generate_link_failed", linkError?.message ?? "missing token");
    return NextResponse.json({ ok: false, reason: "send_failed" }, { status: 500 });
  }
  const signInUrl = `${origin}${signInLinkPath(tokenHash, next)}`;

  // The login's email is where the link goes (it is her registration email).
  try {
    const sent = await sendSignInLinkEmail({ to: loginEmail, signInUrl, code });
    if (sent.skipped && !sent.undeliverable) {
      if (!isOffVercel()) {
        return NextResponse.json({ ok: false, reason: "send_failed" }, { status: 503 });
      }
      // No RESEND_API_KEY off Vercel (local dev, CI): the link is in the server's log
      // instead, and tests fetch their own link from Supabase.
      console.info("[DocCy][dev] sign-in link (not emailed):", signInUrl, "code:", code);
    }
  } catch (sendError) {
    console.error("[DocCy][auth] sign_in_link_email_failed", sendError);
    return NextResponse.json({ ok: false, reason: "send_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, step: "email_sent", email: loginEmail });
}
