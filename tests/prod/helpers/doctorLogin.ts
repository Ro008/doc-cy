import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function ensureMagicLinkRedirect(actionLink: string, redirectTarget: string): string {
  const linkUrl = new URL(actionLink);
  const target = redirectTarget.trim().replace(/\/+$/, "");
  const targetUrl = new URL(target);
  const currentRedirect = linkUrl.searchParams.get("redirect_to");

  if (!currentRedirect) {
    linkUrl.searchParams.set("redirect_to", targetUrl.toString());
    return linkUrl.toString();
  }

  try {
    const current = new URL(currentRedirect);
    if (current.origin !== targetUrl.origin || current.pathname !== targetUrl.pathname) {
      linkUrl.searchParams.set("redirect_to", targetUrl.toString());
      return linkUrl.toString();
    }
  } catch {
    linkUrl.searchParams.set("redirect_to", targetUrl.toString());
    return linkUrl.toString();
  }

  return linkUrl.toString();
}

export async function authenticateDoctorViaMagicLink(
  page: Page,
  email: string,
  baseUrl: string
): Promise<void> {
  const normalizedEmail = email.trim();
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  if (!normalizedEmail) {
    throw new Error("Missing TEST_DOCTOR_EMAIL for magic link auth.");
  }
  if (!normalizedBaseUrl) {
    throw new Error("Missing PLAYWRIGHT_BASE_URL for magic link auth.");
  }
  if (!supabaseUrl || !serviceRole) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for magic link auth."
    );
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const linkResult = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: normalizedEmail,
    options: { redirectTo: `${normalizedBaseUrl}/agenda` },
  });

  if (linkResult.error || !linkResult.data?.properties?.action_link) {
    throw new Error(
      `Unable to generate magic link session for doctor: ${linkResult.error?.message ?? "missing action_link"}`
    );
  }

  const expectedRedirect = `${normalizedBaseUrl}/agenda`;
  const hardenedMagicLink = ensureMagicLinkRedirect(
    linkResult.data.properties.action_link,
    expectedRedirect
  );

  await page.goto(hardenedMagicLink, { waitUntil: "domcontentloaded" });

  // Supabase hash-based redirects can occasionally stall on /login in CI;
  // if that happens, fall back to password auth and force /agenda navigation.
  try {
    await page.waitForURL(/\/agenda(?:[/?#]|$)/, { timeout: 20_000 });
  } catch {
    const candidateEmails = Array.from(
      new Set(
        [
          normalizedEmail,
          (process.env.TEST_DOCTOR_EMAIL ?? "").trim(),
          (process.env.TEST_USER_EMAIL ?? "").trim(),
        ].filter(Boolean)
      )
    );
    const candidatePasswords = Array.from(
      new Set(
        [
          (process.env.TEST_DOCTOR_PASSWORD ?? "").trim(),
          (process.env.TEST_USER_PASSWORD ?? "").trim(),
        ].filter(Boolean)
      )
    );

    if (candidatePasswords.length === 0) {
      throw new Error(
        "Magic link did not reach /agenda and no fallback password is configured (TEST_DOCTOR_PASSWORD/TEST_USER_PASSWORD)."
      );
    }

    const invalidCredentialPairs: string[] = [];
    if (anonKey) {
      for (const candidateEmail of candidateEmails) {
        for (const candidatePassword of candidatePasswords) {
          const authProbe = createClient(supabaseUrl, anonKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { error: probeError } = await authProbe.auth.signInWithPassword({
            email: candidateEmail,
            password: candidatePassword,
          });
          if (probeError && /invalid login credentials/i.test(probeError.message)) {
            invalidCredentialPairs.push(candidateEmail);
          }
          await authProbe.auth.signOut().catch(() => {});
        }
      }
    }

    let reachedAgenda = false;
    const attemptedPairs: string[] = [];
    for (const candidateEmail of candidateEmails) {
      for (const candidatePassword of candidatePasswords) {
        attemptedPairs.push(`${candidateEmail}:${"*".repeat(Math.min(candidatePassword.length, 8))}`);
        await page.goto(`${normalizedBaseUrl}/login`, { waitUntil: "domcontentloaded" });
        await page.getByLabel("Email").fill(candidateEmail);
        await page.getByLabel("Password").fill(candidatePassword);
        await page.getByRole("button", { name: /Sign in/i }).click();

        for (let attempt = 0; attempt < 10; attempt += 1) {
          await page.goto(`${normalizedBaseUrl}/agenda`, { waitUntil: "domcontentloaded" });
          if (/\/agenda(?:[/?#]|$)/.test(page.url())) {
            reachedAgenda = true;
            break;
          }
          await page.waitForTimeout(3_000);
        }
        if (reachedAgenda) break;
      }
      if (reachedAgenda) break;
    }

    if (!reachedAgenda) {
      const visibleLoginError = (
        await page
          .locator("[role='alert'], .text-red-100, .text-red-500, .text-red-600")
          .allTextContents()
      )
        .map((t) => t.trim())
        .filter(Boolean)
        .join(" | ");
      const credentialHint =
        invalidCredentialPairs.length > 0
          ? ` Invalid credential pair(s) detected by Supabase auth probe for: ${Array.from(
              new Set(invalidCredentialPairs)
            ).join(", ")}.`
          : "";
      throw new Error(
        `Fallback password auth did not reach /agenda. Attempted ${attemptedPairs.length} credential combination(s). Current URL: ${page.url()} Visible login error: ${visibleLoginError || "none"}.${credentialHint}`
      );
    }
  }

  await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 20_000 });
}

export async function authenticateDoctorViaPasswordUi(
  page: Page,
  baseUrl: string,
  email?: string,
  password?: string
): Promise<void> {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  const resolvedEmail = (
    email ??
    process.env.TEST_DOCTOR_EMAIL ??
    process.env.TEST_USER_EMAIL ??
    ""
  ).trim();
  const resolvedPassword = (
    password ??
    process.env.TEST_DOCTOR_PASSWORD ??
    process.env.TEST_USER_PASSWORD ??
    ""
  ).trim();

  if (!normalizedBaseUrl) {
    throw new Error("Missing PLAYWRIGHT_BASE_URL for password auth.");
  }
  if (!resolvedEmail) {
    throw new Error("Missing TEST_DOCTOR_EMAIL/TEST_USER_EMAIL for password auth.");
  }
  if (!resolvedPassword) {
    throw new Error("Missing TEST_DOCTOR_PASSWORD/TEST_USER_PASSWORD for password auth.");
  }

  async function probeCredentialWithSupabase(): Promise<{ ok: boolean; message: string }> {
    if (!supabaseUrl || !anonKey) {
      return {
        ok: false,
        message:
          "Supabase probe skipped (missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY).",
      };
    }
    const probe = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: probeError } = await probe.auth.signInWithPassword({
      email: resolvedEmail,
      password: resolvedPassword,
    });
    await probe.auth.signOut().catch(() => {});
    if (probeError) {
      return { ok: false, message: `Supabase probe failed: ${probeError.message}` };
    }
    return { ok: true, message: "Supabase probe succeeded with same credentials." };
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto(`${normalizedBaseUrl}/login`, { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Email")).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Email").fill(resolvedEmail);
    await page.getByLabel("Password").fill(resolvedPassword);
    await page.getByRole("button", { name: /Sign in/i }).click();

    try {
      await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 45_000 });
      return;
    } catch (error) {
      const currentUrl = page.url();
      const looksLikePrematureNativeSubmit =
        /\/login(?:\?|$)/.test(currentUrl) && /[?&]password=/.test(currentUrl);
      const visibleLoginError = (
        await page
          .locator("[role='alert'], .text-red-100, .text-red-500, .text-red-600")
          .allTextContents()
      )
        .map((t) => t.trim())
        .filter(Boolean)
        .join(" | ");
      const looksLikeInvalidCredentialUi =
        /invalid email or password/i.test(visibleLoginError) && /\/login(?:\?|$)/.test(currentUrl);

      if (!looksLikePrematureNativeSubmit || attempt === 3) {
        if (looksLikeInvalidCredentialUi) {
          const probe = await probeCredentialWithSupabase();
          throw new Error(
            `Password UI login did not reach /agenda and returned invalid-credential UI on ${currentUrl}. ` +
              `Visible error: ${visibleLoginError || "none"}. ${probe.message} ` +
              `This helps classify root cause: if probe succeeds, issue is likely UI/session/environment instability; ` +
              `if probe fails, credentials are stale/invalid in CI secrets.`
          );
        }
        throw error;
      }

      await page.waitForTimeout(1_000);
    }
  }
}
