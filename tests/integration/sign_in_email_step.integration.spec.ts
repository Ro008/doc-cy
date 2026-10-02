import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { createTestDoctor, deleteTestDoctor, type TestDoctorFixture } from "./helpers/test-doctor";

/**
 * A professional signs in with her password, then with the link or code emailed to
 * her (user, 2026-09-29). The password alone gives no session; the link works once;
 * a session made from the password alone (e.g. straight through Supabase's API)
 * reaches none of the professional pages or API routes.
 *
 * Locally no email goes out (no RESEND_API_KEY), so the spec asks Supabase for a
 * fresh link/code for the same login, exactly as the app does (a newer link replaces
 * the one the app generated).
 */

const baseUrl = () => (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100").replace(/\/+$/, "");

async function submitPassword(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const submit = page.getByRole("button", { name: /^Sign in$/i });
  await expect(submit).toBeEnabled({ timeout: 20_000 });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await submit.click();
  await expect(page.getByRole("heading", { name: /Check your email/i })).toBeVisible({ timeout: 20_000 });
}

async function freshLink(admin: SupabaseClient, email: string): Promise<{ tokenHash: string; code: string }> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties) throw new Error(`generateLink: ${error?.message}`);
  return { tokenHash: data.properties.hashed_token, code: data.properties.email_otp };
}

async function hasAuthCookie(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some((c) => /^sb-.*-auth-token/.test(c.name) && c.value.length > 0);
}

test.describe("Integration: sign-in with an emailed link", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial", retries: 0 });

  let admin: SupabaseClient;
  let professional: TestDoctorFixture | null = null;

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    const nonce = `link${Date.now()}`.slice(-12);
    professional = await createTestDoctor({
      admin,
      nonce,
      name: `Link Sign In ${nonce.slice(-4)}`,
      specialty: "Cardiology",
    });
  });

  test.afterAll(async () => {
    if (professional) await deleteTestDoctor(professional);
  });

  test("the password alone gives no session", async ({ page }) => {
    await submitPassword(page, professional!.email, professional!.password);
    await expect(page.getByText(professional!.email)).toBeVisible();
    expect(await hasAuthCookie(page)).toBe(false);
    await page.goto("/agenda", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });

  test("a wrong password says so and sends nothing", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const submit = page.getByRole("button", { name: /^Sign in$/i });
    await expect(submit).toBeEnabled({ timeout: 20_000 });
    await page.locator('input[name="email"]').fill(professional!.email);
    await page.locator('input[name="password"]').fill("WrongPass999!");
    await submit.click();
    await expect(page.getByText(/Invalid email or password/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /Check your email/i })).toHaveCount(0);
  });

  test("the emailed link signs her in, once", async ({ page, context }) => {
    test.setTimeout(90_000);
    await submitPassword(page, professional!.email, professional!.password);
    const { tokenHash } = await freshLink(admin, professional!.email);
    const link = `/auth/sign-in-link?token_hash=${encodeURIComponent(tokenHash)}&next=%2Fagenda`;

    await page.goto(link, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/agenda(\?|$)/, { timeout: 30_000 });
    await expect(page.getByTestId("userbar-toggle")).toBeVisible({ timeout: 30_000 });

    // Used once: a second visit (signed out) is refused.
    await context.clearCookies();
    await page.goto(link, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login\?.*link=invalid/, { timeout: 20_000 });
    await expect(page.getByText(/link has expired or was already used/i)).toBeVisible({ timeout: 20_000 });
  });

  test("the code from the email signs her in on the same page", async ({ page }) => {
    test.setTimeout(90_000);
    await submitPassword(page, professional!.email, professional!.password);
    const { code } = await freshLink(admin, professional!.email);

    await page.getByLabel(/Code from the email/i).fill("000000");
    await page.getByRole("button", { name: /^Continue$/i }).click();
    await expect(page.getByText(/code is wrong or has expired/i)).toBeVisible({ timeout: 20_000 });

    await page.getByLabel(/Code from the email/i).fill(code);
    await page.getByRole("button", { name: /^Continue$/i }).click();
    await expect(page).toHaveURL(/\/agenda(\?|$)/, { timeout: 30_000 });
    await expect(page.getByTestId("userbar-toggle")).toBeVisible({ timeout: 30_000 });
  });

  test("a session from the password alone reaches no professional page or API", async ({ page }) => {
    test.setTimeout(90_000);
    // Straight through Supabase's API, skipping DocCy's sign-in page.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({
      email: professional!.email,
      password: professional!.password,
    });
    if (error || !data.session) throw new Error(`password sign-in: ${error?.message}`);
    const session = data.session;

    const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
    const host = new URL(baseUrl()).hostname;
    await page.context().addCookies([
      {
        name: storageKey,
        value: JSON.stringify([session.access_token, session.refresh_token, null, null, null]),
        domain: host,
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    await page.goto("/agenda", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });

    // The browser context's cookies go with the request: the password-only session.
    await page.context().addCookies([
      {
        name: storageKey,
        value: JSON.stringify([session.access_token, session.refresh_token, null, null, null]),
        domain: host,
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    const api = await page.request.post(`${baseUrl()}/api/doctor-settings/trial-notice`);
    expect(api.status()).toBe(401);
  });
});
