import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { loadAccountSummary } from "@/lib/account-summary";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * The signed-in account, for the top-right menu: professional, applicant (with the
 * name and a short-lived link to the photo from their application) or none.
 */
export async function GET() {
  const {
    data: { user },
  } = await createRouteHandlerClient({ cookies }).auth.getUser();
  if (!user) return NextResponse.json({ message: "Not signed in." }, { status: 401, headers: noStore });

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Unavailable." }, { status: 503, headers: noStore });

  try {
    return NextResponse.json(await loadAccountSummary(service, user.id), { headers: noStore });
  } catch (error) {
    console.error("[DocCy] account summary failed", error);
    return NextResponse.json({ message: "Could not load the account." }, { status: 500, headers: noStore });
  }
}
