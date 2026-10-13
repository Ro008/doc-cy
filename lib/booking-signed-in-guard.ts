import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient, createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { isBlockedFromBooking, PROFESSIONAL_SIGNED_IN_CODE } from "@/lib/booking-viewer";

/**
 * Patient-only pages and routes (confirm a request, answer a proposal) refuse a signed-in
 * professional or applicant, who can't act as a patient (user, 2026-10-07). The emailed link
 * is not used up, so the patient can still use it signed out.
 */

/** For server pages: true when a professional or applicant is signed in. */
export async function professionalSignedInOnPage(service: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await createServerComponentClient({ cookies }).auth.getUser();
  return isBlockedFromBooking(service, user?.id ?? null);
}

/** For route handlers: a 403 response to return, or null to carry on. */
export async function refuseSignedInProfessional(
  service: SupabaseClient,
  message: string,
): Promise<NextResponse | null> {
  const {
    data: { user },
  } = await createRouteHandlerClient({ cookies }).auth.getUser();
  if (!(await isBlockedFromBooking(service, user?.id ?? null))) return null;
  return NextResponse.json({ code: PROFESSIONAL_SIGNED_IN_CODE, message }, { status: 403 });
}
