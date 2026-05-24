import { NextResponse } from "next/server";
import { runMonthlyDigestJob } from "@/lib/run-monthly-digest-job";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  const monthKey = url.searchParams.get("month");
  const dryRun = url.searchParams.get("dryRun") === "1";

  try {
    const result = await runMonthlyDigestJob({
      monthKey,
      dryRun,
      resendToOverride: process.env.RESEND_TO_OVERRIDE?.trim() || null,
    });

    console.log("[DocCy][monthly-digest]", JSON.stringify(result));

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[DocCy][monthly-digest] failed", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
