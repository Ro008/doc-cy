import type { SupabaseClient } from "@supabase/supabase-js";

import { PROFESSIONAL_REGISTRATION_REQUEST_TYPE } from "@/lib/professional-registration-request";

/**
 * A signed-in applicant without a professional profile (their registration is
 * pending or was denied) sees only the Status page. The middleware sends every
 * other /agenda page there, and the Status page sends a professional back.
 */

export { REGISTRATION_STATUS_PATH, agendaRedirectForLogin } from "@/lib/registration-status-path";

export type RegistrationStatus =
  | { kind: "confirm_email" }
  | { kind: "pending"; submittedAt: string }
  | { kind: "denied"; decidedAt: string; reason: string }
  | { kind: "withdrawn"; decidedAt: string }
  | { kind: "none" };

type RequestRow = {
  status: string;
  created_at: string;
  decided_at: string | null;
  decision_note: string | null;
};

/**
 * What the Status page shows: a pending request; else a draft still waiting for
 * DocCy's confirmation link (Supabase marks logins confirmed at once, so an applicant
 * can sign in before clicking it); else the latest decided request.
 */
export function registrationStatusFromRequests(
  rows: RequestRow[],
  options: { hasDraft?: boolean } = {},
): RegistrationStatus {
  const latest = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (latest?.status === "pending") return { kind: "pending", submittedAt: latest.created_at };
  if (options.hasDraft) return { kind: "confirm_email" };
  if (!latest) return { kind: "none" };
  if (latest.status === "rejected") {
    return { kind: "denied", decidedAt: String(latest.decided_at), reason: String(latest.decision_note ?? "") };
  }
  if (latest.status === "withdrawn") return { kind: "withdrawn", decidedAt: String(latest.decided_at) };
  // Approved but the profile is gone (deleted since): nothing to show.
  return { kind: "none" };
}

export async function loadRegistrationStatus(
  service: SupabaseClient,
  authUserId: string,
): Promise<RegistrationStatus> {
  const [{ data, error }, drafts] = await Promise.all([
    service
      .from("request_log")
      .select("status, created_at, decided_at, decision_note")
      .eq("applicant_auth_user_id", authUserId)
      .eq("request_type", PROFESSIONAL_REGISTRATION_REQUEST_TYPE)
      .order("created_at", { ascending: false })
      .limit(5),
    service
      .from("request_drafts")
      .select("id")
      .eq("auth_user_id", authUserId)
      .eq("request_type", PROFESSIONAL_REGISTRATION_REQUEST_TYPE)
      .limit(1),
  ]);
  if (error) throw new Error(`registration status: ${error.message}`);
  if (drafts.error) throw new Error(`registration status: ${drafts.error.message}`);
  return registrationStatusFromRequests((data ?? []) as RequestRow[], {
    hasDraft: (drafts.data ?? []).length > 0,
  });
}
