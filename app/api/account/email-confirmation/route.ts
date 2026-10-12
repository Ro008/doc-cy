import { NextResponse } from "next/server";

import { confirmEmailChange } from "@/lib/account-email-change-server";
import { resolvePasswordResetOrigin } from "@/lib/password-reset";
import { consumePublicApiRateLimit, isPublicApiRateLimitDisabled } from "@/lib/public-api-rate-limit";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { getClientIp } from "@/lib/vote-fingerprint";

/**
 * The "Confirm new email" button on /account/confirm-email (user, 2026-10-11). The
 * emailed link is the proof: she may open it on a device where she is not signed in,
 * so there is no session check. The link works once and expires.
 * - 200 { email } · 409 another account took the address · 410 the link no longer
 *   works · 429 too many tries
 */
export async function POST(req: Request) {
  const ip = getClientIp(req.headers);
  if (ip && !isPublicApiRateLimitDisabled()) {
    const limit = consumePublicApiRateLimit({
      bucket: "emailChangeConfirm",
      key: ip,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    });
    if (!limit.ok) return NextResponse.json({ message: "Too many tries." }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = String(body?.token ?? "").trim();

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const siteUrl = resolvePasswordResetOrigin(req) ?? "https://www.mydoccy.com";
  const result = await confirmEmailChange(service, { token, siteUrl });
  if (result.status !== 200) return NextResponse.json({ ok: false }, { status: result.status });
  return NextResponse.json({ email: result.email });
}
