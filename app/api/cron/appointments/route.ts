import { NextResponse } from "next/server";

import { runAppointmentsJob } from "@/lib/appointments-job";
import { sendBuiltEmail } from "@/lib/booking-request-emails";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * The appointments job (lib/appointments-job.ts), every 15 minutes from Supabase pg_cron +
 * pg_net in Production (user, 2026-10-04). Body `{ professionalId? }` limits a run to one
 * professional (integration specs on Testing, which has no schedule).
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const service = createServiceRoleClient();
  if (!service) {
    return NextResponse.json({ ok: false, error: "service role missing" }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { professionalId?: unknown };
  const professionalId = typeof body.professionalId === "string" && body.professionalId.trim() ? body.professionalId.trim() : null;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";

  const result = await runAppointmentsJob({
    service,
    now: new Date(),
    siteUrl,
    send: sendBuiltEmail,
    professionalId,
  });
  return NextResponse.json({ ok: result.errors.length === 0, ...result }, { status: result.errors.length ? 500 : 200 });
}
