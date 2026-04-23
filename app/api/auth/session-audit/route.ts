import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { automatedEmailFooterHtml, escapeHtml, sendResendEmail } from "@/lib/resend";

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
    const when = new Date().toISOString();
    const text = [
      "We detected a new sign-in to your DocCy account.",
      `Date (UTC): ${when}`,
      `Approximate IP: ${ip ?? "unavailable"}`,
      `Browser/device: ${userAgent || "unavailable"}`,
      "",
      "If this was not you, sign out from other sessions in Settings and rotate your password.",
    ].join("\n");

    const safeUa = escapeHtml(userAgent || "unavailable");
    const safeIp = escapeHtml(ip ?? "unavailable");
    const safeWhen = escapeHtml(when);
    const html = `
      <div style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
        <h2 style="margin:0 0 12px;font-size:18px;">New sign-in detected</h2>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.5;">
          We detected a new sign-in to your DocCy account.
        </p>
        <ul style="margin:0 0 14px;padding-left:18px;font-size:13px;line-height:1.6;">
          <li><strong>Date (UTC):</strong> ${safeWhen}</li>
          <li><strong>Approximate IP:</strong> ${safeIp}</li>
          <li><strong>Browser/device:</strong> ${safeUa}</li>
        </ul>
        <p style="margin:0;font-size:13px;line-height:1.5;">
          If this was not you, use <strong>Settings → Sign out on other devices</strong> and rotate your password.
        </p>
        ${automatedEmailFooterHtml()}
      </div>
    `;

    try {
      await sendResendEmail({
        to: user.email,
        subject: "[DocCy] New sign-in detected",
        text,
        html,
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

