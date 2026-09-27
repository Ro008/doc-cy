import type { SupabaseClient } from "@supabase/supabase-js";

import { PROFESSIONAL_REGISTRATION_REQUEST_TYPE } from "@/lib/professional-registration-request";

/**
 * Whether the signed-in login can apply (again) with its own account: after a
 * denial or a withdrawal, "Join as a professional" and "Claim this Profile" reuse
 * the login (no new account, no password), and the application goes to the
 * founders at once because the email is already confirmed.
 */
export type ReapplyState =
  | { kind: "new" }
  | { kind: "reapply"; authUserId: string; email: string }
  | { kind: "pending" }
  | { kind: "professional" };

export async function reapplyStateForUser(
  service: SupabaseClient,
  user: { id: string; email?: string | null; email_confirmed_at?: string | null } | null,
): Promise<ReapplyState> {
  const email = String(user?.email ?? "").trim();
  if (!user || !email || !user.email_confirmed_at) return { kind: "new" };

  const { data: professional } = await service
    .from("professionals")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (professional?.id) return { kind: "professional" };

  const [{ data: pending }, { data: draft }] = await Promise.all([
    service
      .from("request_log")
      .select("id")
      .eq("applicant_auth_user_id", user.id)
      .eq("request_type", PROFESSIONAL_REGISTRATION_REQUEST_TYPE)
      .eq("status", "pending")
      .limit(1),
    service.from("request_drafts").select("id").eq("auth_user_id", user.id).limit(1),
  ]);
  if ((pending ?? []).length > 0 || (draft ?? []).length > 0) return { kind: "pending" };

  return { kind: "reapply", authUserId: user.id, email };
}
