import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { checkProfessionalContact } from "@/lib/professional-contact-check";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const MAX_LENGTH = 254;

/**
 * Register Account step: is this email / personal mobile already used by another
 * professional? Answers only "taken or not" per field, never who uses it. A signed-in
 * applicant applying again is excluded from their own login and request. The submit
 * action checks again on the server, so this is guidance, not the barrier.
 */
export async function POST(req: NextRequest) {
  let body: { email?: unknown; mobile?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400, headers: noStore });
  }
  const email = typeof body.email === "string" ? body.email.trim().slice(0, MAX_LENGTH) : "";
  const mobile = typeof body.mobile === "string" ? body.mobile.trim().slice(0, 32) : "";
  if (!email && !mobile) {
    return NextResponse.json({ email: null, mobile: false }, { headers: noStore });
  }

  const limited = enforcePublicApiRateLimit(req, "registerContactCheck");
  if (limited) return limited;

  const service = createServiceRoleClient();
  if (!service) {
    return NextResponse.json({ message: "Unavailable." }, { status: 503, headers: noStore });
  }

  const {
    data: { user },
  } = await createRouteHandlerClient({ cookies }).auth.getUser();

  try {
    const use = await checkProfessionalContact(service, {
      email,
      mobile,
      applicantAuthUserId: user?.id ?? null,
    });
    return NextResponse.json(use, { headers: noStore });
  } catch (error) {
    console.error("[DocCy] register contact check failed", error);
    return NextResponse.json({ message: "Could not check." }, { status: 500, headers: noStore });
  }
}
