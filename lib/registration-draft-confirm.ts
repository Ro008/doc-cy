import type { SupabaseClient } from "@supabase/supabase-js";

import { PROFESSIONAL_REGISTRATION_REQUEST_TYPE } from "@/lib/professional-registration-request";
import { notifyFoundersOfRegistrationRequest } from "@/lib/registration-request-notify";

/**
 * After the applicant confirms their email: their registration draft becomes a
 * pending request in request_log, and the founders are emailed once (a second
 * click on the link finds the request already there and sends nothing).
 * `requestId` is null when the login has no draft and no pending request.
 */
export async function confirmRegistrationDraft(
  service: SupabaseClient,
  authUserId: string,
): Promise<{ requestId: string | null; created: boolean }> {
  const { data, error } = await service.rpc("request_draft_confirm", {
    p_auth_user_id: authUserId,
    p_request_type: PROFESSIONAL_REGISTRATION_REQUEST_TYPE,
  });
  if (error) throw new Error(`request_draft_confirm failed: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as
    | { request_id?: string | null; created?: boolean | null }
    | null
    | undefined;
  const requestId = row?.request_id ? String(row.request_id) : null;
  const created = row?.created === true;
  if (requestId && created) {
    await notifyFoundersOfRegistrationRequest(service, requestId);
  }
  return { requestId, created };
}
