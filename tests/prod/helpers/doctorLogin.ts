import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

type LoginOutcome = "agenda" | "invalid-credentials" | "timeout";

async function submitAndWaitForOutcome(page: Page): Promise<LoginOutcome> {
  const invalidCredentialsNotice = page.getByText(/Invalid email or password/i);

  try {
    await page.waitForURL(/\/agenda(?:[/?#]|$)/, { timeout: 30_000 });
    return "agenda";
  } catch {
    // Continue below to classify why we did not reach /agenda.
  }

  if (await invalidCredentialsNotice.isVisible()) {
    return "invalid-credentials";
  }

  return "timeout";
}

export async function loginDoctorToAgenda(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  const normalizedEmail = email.trim();
  const normalizedPassword = password.trim();
  if (!normalizedEmail || !normalizedPassword) {
    throw new Error(
      "Doctor login credentials are empty after trimming TEST_DOCTOR_EMAIL / TEST_DOCTOR_PASSWORD."
    );
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in CI env."
    );
  }

  // Deterministic preflight: check credentials directly against the Supabase project configured for CI.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const preflight = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: normalizedPassword,
  });
  if (preflight.error) {
    throw new Error(
      `Supabase auth preflight failed for TEST_DOCTOR_EMAIL/TEST_DOCTOR_PASSWORD: ${preflight.error.message}`
    );
  }
  await supabase.auth.signOut();

  const expectedSupabaseHost = new URL(supabaseUrl).host;
  let observedUiSupabaseHost: string | null = null;
  page.on("request", (request) => {
    const url = request.url();
    if (!/\/auth\/v1\/token(\?|$)/.test(url)) return;
    try {
      observedUiSupabaseHost = new URL(url).host;
    } catch {
      // no-op: keep best effort diagnostics only
    }
  });

  await page.goto("/login");

  // CI can occasionally miss the first submit due to transient rendering/network timing.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.getByLabel("Email").fill(normalizedEmail);
    await page.getByLabel("Password").fill(normalizedPassword);
    await page.getByRole("button", { name: /Sign in/i }).click();

    const outcome = await submitAndWaitForOutcome(page);
    if (outcome === "agenda") {
      await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 15_000 });
      return;
    }

    if (outcome === "invalid-credentials") {
      const mismatchDetail =
        observedUiSupabaseHost && observedUiSupabaseHost !== expectedSupabaseHost
          ? ` UI is calling Supabase host "${observedUiSupabaseHost}" but CI preflight uses "${expectedSupabaseHost}".`
          : "";
      throw new Error(
        `UI login returned "Invalid email or password" but Supabase auth preflight succeeded.${mismatchDetail} Check deployed app env vars (e.g. Vercel Production NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY) and ensure they match CI secrets and PLAYWRIGHT_BASE_URL target.`
      );
    }
  }

  throw new Error(
    `Doctor login did not reach /agenda after 2 attempts (current URL: ${page.url()}). This indicates CI auth latency/throttling or provider-side issues.`
  );
}
