import { createClient } from "@supabase/supabase-js";
import { isSupabaseAuthInfraError } from "./signInDoctorWithInfraSkip";

function isInvalidCredentialsError(error: unknown): boolean {
  const message = String((error as { message?: unknown } | null)?.message ?? "")
    .trim()
    .toLowerCase();
  return message.includes("invalid login credentials");
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pre-check before login-form UI tests: confirms integration Auth accepts the test doctor.
 * Retries transient infra errors, then fails loudly (never skips) so CI stays honest.
 */
export async function assertDoctorPasswordAuthReachable(
  email: string,
  password: string,
): Promise<void> {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!supabaseUrl || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY for auth pre-check.",
    );
  }

  const maxAttempts = 8;
  let lastMessage = "unknown error";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({ email, password });
    await client.auth.signOut().catch(() => {});

    if (!error) {
      return;
    }

    lastMessage = error.message;

    if (isInvalidCredentialsError(error)) {
      throw new Error(
        `Test doctor credentials rejected by Supabase Auth: ${lastMessage}. ` +
          `Fix INTEGRATION_TEST_USER_* / TEST_USER_* secrets or the integration seed doctor.`,
      );
    }

    const canRetry = isSupabaseAuthInfraError(error) && attempt < maxAttempts;
    if (!canRetry) {
      break;
    }
    await sleep(600 * attempt);
  }

  throw new Error(
    `Integration Supabase Auth unavailable after ${maxAttempts} pre-check attempts (${lastMessage}). ` +
      `Login-form UI cannot be validated until Auth responds — re-run CI or check integration project health.`,
  );
}
