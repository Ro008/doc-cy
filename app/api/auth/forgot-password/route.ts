import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  consumePublicApiRateLimit,
  enforcePublicApiRateLimit,
} from "@/lib/public-api-rate-limit";
import {
  passwordResetCallbackUrl,
  passwordResetLinkFromGenerateLink,
  resolvePasswordResetOrigin,
} from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/send-password-reset-email";

const EMAIL_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_LIMIT = 5;

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim();
}

function looksLikeEmail(email: string): boolean {
  if (email.length < 5 || email.length > 254) return false;
  if (email.includes(" ")) return false;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;
  const domain = email.slice(at + 1);
  return domain.includes(".");
}

function isUnknownUserError(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes("not found") || msg.includes("user with this email");
}

export async function POST(req: Request) {
  const limited = enforcePublicApiRateLimit(req, "passwordReset");
  if (limited) return limited;

  if (!process.env.RESEND_API_KEY?.trim()) {
    console.warn("[DocCy] Password reset skipped: RESEND_API_KEY missing.");
    return NextResponse.json({ ok: false, reason: "email_not_configured" }, { status: 503 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "service_role_not_configured" }, { status: 503 });
  }

  const origin = resolvePasswordResetOrigin(req);
  if (!origin) {
    return NextResponse.json({ ok: false, reason: "invalid_origin" }, { status: 400 });
  }

  let body: { email?: unknown };
  try {
    body = (await req.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!looksLikeEmail(email)) {
    return NextResponse.json({ ok: false, reason: "invalid_email" }, { status: 400 });
  }

  const emailLimit = consumePublicApiRateLimit({
    bucket: "passwordResetEmail",
    key: email.toLowerCase(),
    limit: EMAIL_LIMIT,
    windowMs: EMAIL_WINDOW_MS,
  });
  if (!emailLimit.ok) {
    // Same success as an unknown address — do not leak whether the account exists.
    return NextResponse.json({ ok: true });
  }

  const redirectTo = passwordResetCallbackUrl(origin);
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (error) {
    if (isUnknownUserError(error.message ?? "")) {
      return NextResponse.json({ ok: true });
    }
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("rate") || msg.includes("too many")) {
      return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });
    }
    console.error("[DocCy] password reset generateLink failed", error.message);
    return NextResponse.json({ ok: false, reason: "generate_failed" }, { status: 500 });
  }

  const resetUrl = passwordResetLinkFromGenerateLink(origin, data?.properties);
  if (!resetUrl) {
    console.error("[DocCy] password reset generateLink missing token");
    return NextResponse.json({ ok: false, reason: "generate_failed" }, { status: 500 });
  }

  try {
    await sendPasswordResetEmail({ to: email, resetUrl });
  } catch (sendError) {
    console.error("[DocCy] password reset Resend failed", sendError);
    return NextResponse.json({ ok: false, reason: "send_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
