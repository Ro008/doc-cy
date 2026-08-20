/**
 * Weekly outreach to unregistered directory listings (booking + show-phone demand).
 *
 * After merge this still does NOT email anyone until all three are done, in order:
 * 1. Deploy this branch to Vercel production.
 * 2. Apply migration `20260820180000_directory_manual_outreach.sql` to prod
 *    (`db:prod:push` — only when explicitly requested).
 * 3. Vercel → Production env: set `DIRECTORY_MANUAL_OUTREACH_ENABLED=1` and redeploy.
 *    Without that flag the Monday cron runs and sends zero emails.
 *
 * Reply-To defaults to `Roxy <doccyteam@gmail.com>` (override: RESEND_OUTREACH_REPLY_TO).
 * Schedule: Monday 04:00 UTC (`vercel.json`). Cap: 25 sends/run.
 */
import { NextResponse } from "next/server";
import { runDirectoryManualOutreachJob } from "@/lib/run-directory-manual-outreach-job";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  try {
    const result = await runDirectoryManualOutreachJob({
      dryRun,
      resendToOverride: process.env.RESEND_TO_OVERRIDE?.trim() || null,
    });
    console.log("[DocCy][directory-manual-outreach]", JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[DocCy][directory-manual-outreach] failed", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
