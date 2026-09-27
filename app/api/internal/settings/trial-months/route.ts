import { NextRequest, NextResponse } from "next/server";

import { requireAdmin, requireAdminWrite } from "@/lib/admin-auth";
import { MAX_TRIAL_MONTHS, parseTrialMonths } from "@/lib/pro-access";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { loadTrialMonths, saveTrialMonths } from "@/lib/trial-months-setting";

/**
 * The free-trial length in whole months. Every admin can read it; only founders can
 * change it (partners get 403 `read_only`).
 */

export async function GET() {
  const { response: denied } = await requireAdmin();
  if (denied) return denied;

  const service = createServiceRoleClient();
  if (!service) {
    return NextResponse.json({ message: "Server is not configured." }, { status: 503 });
  }
  const result = await loadTrialMonths(service);
  if (result.ok === false) {
    console.error("[trial-months] load failed", result.error);
    return NextResponse.json({ message: "Could not load the trial length." }, { status: 500 });
  }
  return NextResponse.json({ months: result.months });
}

export async function PATCH(req: NextRequest) {
  const { admin, response: denied } = await requireAdminWrite();
  if (denied) return denied;

  const service = createServiceRoleClient();
  if (!service) {
    return NextResponse.json({ message: "Server is not configured." }, { status: 503 });
  }

  let body: { months?: unknown };
  try {
    body = (await req.json()) as { months?: unknown };
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 });
  }

  const months = parseTrialMonths(body.months);
  if (months == null) {
    return NextResponse.json(
      { message: `The trial must be a whole number of months from 0 to ${MAX_TRIAL_MONTHS}.` },
      { status: 400 },
    );
  }

  const result = await saveTrialMonths(service, months, admin.id);
  if (result.ok === false) {
    console.error("[trial-months] save failed", result.error);
    return NextResponse.json({ message: "Could not save the trial length." }, { status: 500 });
  }
  return NextResponse.json({ months: result.months });
}
