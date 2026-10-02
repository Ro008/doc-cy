import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { withdrawRegistrationRequest } from "@/lib/registration-withdraw";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * Status page: the signed-in applicant withdraws their own pending registration.
 * The login comes from the session only; the request is found from it.
 */
export async function POST() {
  const service = createServiceRoleClient();
  if (!service) {
    return NextResponse.json({ message: "Unavailable." }, { status: 503, headers: noStore });
  }
  const {
    data: { user },
  } = await createRouteHandlerClient({ cookies }).auth.getUser();

  const result = await withdrawRegistrationRequest(service, user?.id ?? "");
  if (result.ok === false) {
    return NextResponse.json({ message: result.message }, { status: result.status, headers: noStore });
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
