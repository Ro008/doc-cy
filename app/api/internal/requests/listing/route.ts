import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { lookupClaimableListing } from "@/lib/registration-requests";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Checks a listing URL pasted into a registration request: 200 with the listing when
 * it is an unregistered listing, 400 not a profile URL, 404 unknown, 409 registered.
 */
export async function GET(req: NextRequest) {
  const { response: denied } = await requireAdmin();
  if (denied) return denied;

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Server is not configured." }, { status: 503 });

  const result = await lookupClaimableListing(service, req.nextUrl.searchParams.get("url") ?? "");
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ listing: result.listing });
}
