import type { SupabaseClient } from "@supabase/supabase-js";

import { accountKind, type AccountKind } from "@/lib/account-summary";
import { loadRegistrationStatus } from "@/lib/registration-status";

/**
 * A signed-in professional can't book, with anyone, herself included (user, 2026-10-06).
 * Applicants count as professionals. Founders (no profile, no application) and
 * signed-out visitors book as patients. The public site stays viewable either way.
 */
export type BookingViewerMode = "patient" | "own_profile" | "professional";

export function bookingViewerMode(kind: AccountKind | null, isOwnProfile: boolean): BookingViewerMode {
  if (kind !== "professional" && kind !== "applicant") return "patient";
  return kind === "professional" && isOwnProfile ? "own_profile" : "professional";
}

/** The signed-in login's kind (service role): professional, applicant or none. */
export async function loadBookingAccountKind(service: SupabaseClient, authUserId: string): Promise<AccountKind> {
  const { data: professional, error } = await service
    .from("professionals")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(`booking account kind: ${error.message}`);
  if (professional?.id) return "professional";
  const status = await loadRegistrationStatus(service, authUserId);
  return accountKind({ hasProfessional: false, status: status.kind });
}

/**
 * True when the signed-in login is a professional or applicant, who can't book or confirm a
 * booking as a patient. Signed out (null) is never blocked, and a failed lookup fails open.
 */
export async function isBlockedFromBooking(service: SupabaseClient, authUserId: string | null): Promise<boolean> {
  if (!authUserId) return false;
  const kind = await loadBookingAccountKind(service, authUserId).catch((err) => {
    console.error("[DocCy] booking: account kind", err);
    return null;
  });
  return bookingViewerMode(kind, false) !== "patient";
}

export const PROFESSIONAL_SIGNED_IN_CODE = "professional_signed_in";
