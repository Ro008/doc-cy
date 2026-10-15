import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin, requireAdminWrite } from "@/lib/admin-auth";
import { parseDefaultScheme } from "@/lib/profile-scheme";
import {
  loadDefaultScheme,
  PUBLIC_DEFAULT_SCHEME_TAG,
  saveDefaultScheme,
} from "@/lib/site-default-scheme";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * The public site's default Light / Dark mode, for visitors who have not picked one.
 * Every admin can read it; only founders can change it (partners get 403 `read_only`).
 */

export async function GET() {
  const { response: denied } = await requireAdmin();
  if (denied) return denied;

  const service = createServiceRoleClient();
  if (!service) {
    return NextResponse.json({ message: "Server is not configured." }, { status: 503 });
  }
  const result = await loadDefaultScheme(service);
  if (result.ok === false) {
    console.error("[public-default-scheme] load failed", result.error);
    return NextResponse.json({ message: "Could not load the default mode." }, { status: 500 });
  }
  return NextResponse.json({ scheme: result.scheme });
}

export async function PATCH(req: NextRequest) {
  const { admin, response: denied } = await requireAdminWrite();
  if (denied) return denied;

  const service = createServiceRoleClient();
  if (!service) {
    return NextResponse.json({ message: "Server is not configured." }, { status: 503 });
  }

  let body: { scheme?: unknown };
  try {
    body = (await req.json()) as { scheme?: unknown };
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 });
  }

  const scheme = parseDefaultScheme(body.scheme);
  if (scheme == null) {
    return NextResponse.json({ message: "The default must be light or dark." }, { status: 400 });
  }

  const result = await saveDefaultScheme(service, scheme, admin.id);
  if (result.ok === false) {
    console.error("[public-default-scheme] save failed", result.error);
    return NextResponse.json({ message: "Could not save the default mode." }, { status: 500 });
  }
  // Visitors without a choice see the new default on their next page, not in 5 minutes.
  revalidateTag(PUBLIC_DEFAULT_SCHEME_TAG);
  return NextResponse.json({ scheme: result.scheme });
}
