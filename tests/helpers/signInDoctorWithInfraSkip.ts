import { test, type Page } from "@playwright/test";
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
 * Same as {@link signInDoctorAndSetCookies}, but skips the test when Supabase Auth
 * returns known transient / infra errors (common on shared integration projects in CI).
 */
export async function signInDoctorOrSkipOnInfraError(
  page: Page,
  supabaseClient?: SupabaseClient,
  options?: DoctorAuthOptions
): Promise<void> {
  try {
    await signInDoctorAndSetCookies(page, supabaseClient, options);
  } catch (error) {
    if (isSupabaseAuthInfraError(error)) {
      test.skip(
        true,
        `Supabase Auth infra is unstable in CI: ${String((error as Error).message)}`
      );
    }
    throw error;
  }
}
