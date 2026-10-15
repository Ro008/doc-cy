import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { PROFILE_HEADLINE_MAX_LENGTH, normalizeProfileHeadline, profileHeadlineError } from "@/lib/profile-headline";
import { setProfessionalHeadline } from "@/lib/profile-headline-server";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Settings → Profile → "Headline" (user, 2026-10-13): the optional line under her name on
 * her public profile. No founder, but recorded (`professional_headline_set` writes the
 * headline and its request_log row together), at most 5 changes in a rolling 30 days.
 * Body `{ headline: string | null }`.
 * - 200 { ok, changed, headline } · 400 not text, or over 90 characters · 401 signed out ·
 *   403 not a professional · 429 changed too often (when it opens again is in the message)
 */
export async function PATCH(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  const { data: pro } = await supabase.from("professionals").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!pro?.id) return NextResponse.json({ message: "Forbidden." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { headline?: unknown } | null;
  const raw = body?.headline;
  if (!body || (raw !== null && typeof raw !== "string")) {
    return NextResponse.json({ message: "headline must be text or null." }, { status: 400 });
  }
  if (profileHeadlineError(raw ?? "")) {
    return NextResponse.json(
      { message: `Keep the headline under ${PROFILE_HEADLINE_MAX_LENGTH} characters.` },
      { status: 400 },
    );
  }
  const headline = normalizeProfileHeadline(raw);

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const saved = await setProfessionalHeadline(service, { professionalId: pro.id, headline });
  if (saved.ok === false) {
    return NextResponse.json({ message: saved.message }, { status: saved.status });
  }
  return NextResponse.json({ ok: true, changed: saved.changed, headline });
}
