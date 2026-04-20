import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export async function authenticateDoctorViaMagicLink(
  page: Page,
  email: string,
  baseUrl: string
): Promise<void> {
  const normalizedEmail = email.trim();
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

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

  await page.goto(linkResult.data.properties.action_link, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/agenda(?:[/?#]|$)/, { timeout: 30_000 });
  await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 10_000 });
}
