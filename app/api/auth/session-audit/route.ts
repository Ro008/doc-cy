import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { buildNewSignInAlertEmail } from "@/lib/account-security-emails";
import { resolvePasswordResetOrigin } from "@/lib/password-reset";
import { sendResendEmail } from "@/lib/resend";

const DEVICE_COOKIE = "doccy-device-id";
const DEVICE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
// TEMP: keep disabled while there are no real users to avoid unnecessary Resend usage.
// To re-enable in the future, set DOC_CY_SEND_NEW_SIGNIN_ALERTS=1 in env.
const SEND_NEW_SIGNIN_ALERTS = process.env.DOC_CY_SEND_NEW_SIGNIN_ALERTS === "1";

function extractClientIp(forwardedFor: string | null): string | null {
  if (!forwardedFor) return null;
  const first = forwardedFor.split(",")[0]?.trim();
  return first || null;
}

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn("[DocCy][auth] session_audit_unauthenticated", {
      authError: authError?.message ?? null,
    });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const existingDeviceId = cookies().get(DEVICE_COOKIE)?.value?.trim() || "";
  const isNewDevice = !existingDeviceId;
  const deviceId = existingDeviceId || crypto.randomUUID();

  const userAgent = (req.headers.get("user-agent") || "").slice(0, 512);
  const ip = extractClientIp(req.headers.get("x-forwarded-for"));

  console.info("[DocCy][auth] login_success", {
    userId: user.id,
    email: user.email ?? null,
    deviceId,
    isNewDevice,
    ip,
    userAgent,
  });

  if (isNewDevice && user.email && SEND_NEW_SIGNIN_ALERTS) {
    const content = buildNewSignInAlertEmail({
      when: new Date().toISOString(),
      ip,
      userAgent,
      siteUrl: resolvePasswordResetOrigin(req) ?? "https://www.mydoccy.com",
    });

    try {
      await sendResendEmail({
        to: user.email,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
      console.info("[DocCy][auth] new_device_alert_sent", { userId: user.id, email: user.email });
    } catch (err) {
      console.error("[DocCy][auth] new_device_alert_failed", {
        userId: user.id,
        email: user.email,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  if (isNewDevice && user.email && !SEND_NEW_SIGNIN_ALERTS) {
    console.info("[DocCy][auth] new_device_alert_skipped_disabled", {
      userId: user.id,
      email: user.email,
    });
  }

  const res = NextResponse.json({ ok: true, isNewDevice });
  res.cookies.set({
    name: DEVICE_COOKIE,
    value: deviceId,
    httpOnly: true,
    sameSite: "lax",
    secure: req.url.startsWith("https://"),
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}

