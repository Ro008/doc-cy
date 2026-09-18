import type { Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  signInDoctorAndSetCookies,
  type DoctorAuthOptions,
} from "./doctorAuth";

export function isSupabaseAuthInfraError(error: unknown): boolean {
  const message = String((error as { message?: unknown } | null)?.message ?? "")
    .trim()
    .toLowerCase();
  return (
    message.includes("database error querying schema") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable")
  );
}

/**
 * Sign the test doctor in, failing loudly when Auth will not cooperate.
 *
 * This used to call `test.skip()` on infra-shaped errors, on the theory that a
 * shared integration project flakes and a skipped test beats a red build. In
 * practice it hid real breakage for weeks: while the integration credentials
 * were invalid, Supabase answered "Database error querying schema", every
 * signed-in spec skipped itself, and PRs #172 and #173 reported green having
 * run none of them. The damage only surfaced once the project was healthy
 * enough to return a clean "Invalid login credentials" instead.
 *
 * Retrying is already handled a layer down: `signInDoctorAndSetCookies` makes
 * up to 8 attempts with increasing backoff before it throws, which is the same
 * policy `assertDoctorPasswordAuthReachable` applies and whose docstring states
 * the intent — "retries transient infra errors, then fails loudly (never skips)
 * so CI stays honest". By the time an error reaches here, the transient case
 * has already been given its chances.
 *
 * A genuine Supabase outage will now turn CI red rather than green. That is the
 * point: a run that could not sign in has not tested anything, and should not
 * claim it has.
 */
export async function signInDoctorOrFail(
  page: Page,
  supabaseClient?: SupabaseClient,
  options?: DoctorAuthOptions,
): Promise<void> {
  try {
    await signInDoctorAndSetCookies(page, supabaseClient, options);
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    if (isSupabaseAuthInfraError(error)) {
      throw new Error(
        `Supabase Auth did not respond after the sign-in helper's retries: ${message}. ` +
          `This spec cannot verify anything without a session, so it fails rather than ` +
          `skipping. Check integration project health, then re-run.`,
      );
    }
    throw error;
  }
}
