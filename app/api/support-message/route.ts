import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { createServiceRoleClient } from "@/lib/supabase-service";
import { isSupabaseMissingTableError } from "@/lib/supabase-db-errors";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { getClientIp, voterFingerprint } from "@/lib/vote-fingerprint";
import { parseSupportMessageBody } from "@/lib/support-message";
import { USER_EVENTS_TABLE, supportMessageEvent } from "@/lib/user-events";

export const dynamic = "force-dynamic";

/**
 * Keeps a copy of every support-form message in `user_events` (Formspree only archives 30 days
 * on our plan). The form still posts to Formspree itself, which emails the founders.
 */
export async function POST(req: Request) {
  const limited = enforcePublicApiRateLimit(req, "supportMessage");
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  const {
    data: { user },
  } = await createRouteHandlerClient({ cookies }).auth.getUser();

  const parsed = parseSupportMessageBody(raw, Boolean(user));
  if ("reason" in parsed) {
    return NextResponse.json({ ok: false, reason: parsed.reason }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "service_role_not_configured" }, { status: 503 });
  }

  const { value } = parsed;
  const { error } = await supabase.from(USER_EVENTS_TABLE).insert(
    supportMessageEvent({
      userId: user?.id ?? null,
      visitorKey: voterFingerprint("support-message", getClientIp(req.headers)),
      details: {
        topic: value.topic,
        message: value.message,
        email: value.email,
        url: value.url,
        context: value.context,
      },
    }),
  );

  if (error) {
    const code = String((error as { code?: string }).code ?? "");
    console.error("[DocCy][support-message] insert_failed", code, error.message);
    const reason = isSupabaseMissingTableError(error) ? "table_missing" : "insert_failed";
    return NextResponse.json({ ok: false, reason }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
