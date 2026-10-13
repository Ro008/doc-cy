import type { SupabaseClient } from "@supabase/supabase-js";

import type { HttpResult } from "@/lib/profile-change-requests-server";
import { normalizeProfileHeadline } from "@/lib/profile-headline";
import { tooOftenRefusal } from "@/lib/request-frequency";

/**
 * Server-only (service role): the headline under her name on the public profile (user,
 * 2026-10-13). It changes as she pleases, with no founder: `professional_headline_set`
 * makes the change and its request_log row together, at most 5 in a rolling 30 days.
 */

/** Her headline, or null. Also null when the read fails (a database without the column yet). */
export async function loadProfileHeadline(
  service: SupabaseClient,
  professionalId: string,
): Promise<string | null> {
  const { data, error } = await service
    .from("professionals")
    .select("profile_headline")
    .eq("id", professionalId)
    .maybeSingle();
  if (error) {
    console.error("[DocCy] profile headline", error.message);
    return null;
  }
  return normalizeProfileHeadline((data as { profile_headline?: unknown } | null)?.profile_headline);
}

/** Sets or clears (null / empty) the headline (professional_headline_set). */
export async function setProfessionalHeadline(
  service: SupabaseClient,
  input: { professionalId: string; headline: string | null },
): Promise<HttpResult<{ changed: boolean }>> {
  const { data: requestId, error } = await service.rpc("professional_headline_set", {
    p_professional_id: input.professionalId,
    p_headline: input.headline,
  });
  // Changed too often (request_types limits): she is told when it opens again.
  const tooOften = tooOftenRefusal(error);
  if (tooOften) return { ok: false, ...tooOften };
  if (error) {
    if (error.code === "22023") {
      return { ok: false, status: 400, message: "That headline cannot be saved." };
    }
    console.error("[DocCy] headline change", error);
    return { ok: false, status: 500, message: "Could not save. Please try again." };
  }
  return { ok: true, changed: Boolean(requestId) };
}
