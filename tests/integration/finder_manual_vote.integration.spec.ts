import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { dismissCookieConsentIfPresent } from "../prod/helpers/dismissCookieConsent";

const THANKS_TOAST_RE = /Thank you! We will notify the doctor\./i;

/**
 * Clicks the request-online-booking overlay on a manual finder card after a **random**
 * district + **random** specialty (from live dropdowns), so runs tend to hit different
 * cards and you see varied rows on the founder dashboard (testing DB only).
 *
 * Rows are **not** deleted after the test so `/internal/directory` keeps the signal; repeat
 * runs may get HTTP 200 (duplicate fingerprint) for the same listing + network.
 *
 * Data target (IMPORTANT):
 * - Same safety gate as other integration finder tests (`assertSafeIntegrationTarget`).
 * - Server must use **testing** Supabase (e.g. `dev-with-env.mjs .env.testing.local`).
 * - Refuses prod site URL + mydoccy with testing env mismatch (see playwright.config).
 */

function normalizeUrl(u: string): string {
  return u.replace(/\/+$/, "");
}

function assertSafeIntegrationTarget(baseUrl: string, supabaseUrl: string): string | null {
  const safeEnv = process.env.INTEGRATION_SAFE_ENV === "1";
  const prodSupabase = normalizeUrl(process.env.PROD_NEXT_PUBLIC_SUPABASE_URL ?? "");
  const integrationSupabase = normalizeUrl(supabaseUrl);
  const usingProductionSupabase = prodSupabase.length > 0 && integrationSupabase === prodSupabase;
  const unsafeBase = /mydoccy\.com/i.test(baseUrl);
  if (!safeEnv || unsafeBase || usingProductionSupabase) {
    return "Unsafe target or missing INTEGRATION_SAFE_ENV.";
  }
  return null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

async function optionValues(select: Locator): Promise<string[]> {
  return select.locator("option").evaluateAll((els) =>
    els.map((e) => (e as HTMLOptionElement).value),
  );
}

async function optionValuesNonEmpty(select: Locator): Promise<string[]> {
  return (await optionValues(select)).filter((v) => v.length > 0);
}

async function applyFinderFilters(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Find$/i }).click();
}

async function findManualCardRequestCta(page: Page): Promise<Locator> {
  const districtSelect = page.getByLabel("District");
  const specialtySelect = page.getByLabel("Specialty");

  const districtOrder = shuffle(await optionValues(districtSelect));

  for (const districtValue of districtOrder) {
    await districtSelect.selectOption(districtValue);
    await applyFinderFilters(page);
    await expect(page).toHaveURL(/\/(?:nicosia|limassol|paphos|larnaca|famagusta|all)(?:\/|$)/, { timeout: 20_000 });
    await expect(specialtySelect).toBeEnabled({ timeout: 20_000 });

    const specialtySlugs = shuffle(await optionValuesNonEmpty(specialtySelect));
    if (specialtySlugs.length === 0) {
      continue;
    }

    for (const slug of specialtySlugs) {
      await specialtySelect.selectOption(slug);
      await applyFinderFilters(page);
      await expect(page).toHaveURL(/\/(?:nicosia|limassol|paphos|larnaca|famagusta|all)\//, { timeout: 20_000 });

      const manualCard = page
        .locator("article")
        .filter({ hasText: /Are you this professional\?/i })
        .first();
      const requestCta = manualCard
        .getByTestId("finder-manual-request-online-booking")
        .first();
      try {
        await expect(requestCta).toBeVisible({ timeout: 10_000 });
        return requestCta;
      } catch {
        /* no manual card with request overlay for this combo */
      }
    }
  }

  throw new Error(
    "No manual finder card with a request-online-booking overlay found for any random district/specialty combo.",
  );
}

async function expectThanksToastOnScreen(page: Page) {
  const toast = page.locator("[data-sonner-toast]").getByText(THANKS_TOAST_RE);
  await expect(toast).toBeVisible({ timeout: 15_000 });
  await expect(toast).toBeInViewport();
}

async function clickRequestAndWaitForVote(page: Page, requestCta: Locator) {
  const responsePromise = page.waitForResponse(
    (res) =>
      res.url().includes("/api/directory-manual/patient-booking-request") &&
      res.request().method() === "POST",
  );
  const requestPromise = page.waitForRequest(
    (req) =>
      req.url().includes("/api/directory-manual/patient-booking-request") &&
      req.method() === "POST",
  );
  await requestCta.click();
  return Promise.all([requestPromise, responsePromise]);
}

test.describe("Integration: finder manual card vote", () => {
  test("manual request overlay vote succeeds against testing Supabase (not prod)", async ({
    page,
  }) => {
    const baseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!supabaseUrl || !serviceRole, "Missing integration env vars.");

    const admin = createClient(supabaseUrl, serviceRole);
    let manualId: string | null = null;

    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /The most complete health directory in Cyprus|Cyprus['’]s most complete health directory|Find your next health professional(?: in Cyprus)?|Health Professionals in Cyprus|Find a Professional/i,
      })
    ).toBeVisible({ timeout: 25_000 });
    await dismissCookieConsentIfPresent(page);

    const requestCta = await findManualCardRequestCta(page);
    const [req, res] = await clickRequestAndWaitForVote(page, requestCta);
    const body = req.postData();
    if (body) {
      try {
        const parsed = JSON.parse(body) as { manualId?: string };
        if (parsed.manualId && typeof parsed.manualId === "string") {
          manualId = parsed.manualId;
        }
      } catch {
        /* ignore */
      }
    }

    expect([200, 201]).toContain(res.status());
    await expect(page.getByRole("heading", { name: /Profile not activated yet/i })).toHaveCount(0);
    await expectThanksToastOnScreen(page);

    if (res.status() === 201 && manualId) {
      const { data: rows, error } = await admin
        .from("directory_manual_patient_booking_requests")
        .select("id")
        .eq("manual_id", manualId)
        .order("created_at", { ascending: false })
        .limit(5);
      expect(error).toBeNull();
      expect(rows?.length ?? 0).toBeGreaterThan(0);
    }

    // Keep rows in testing Supabase for founder dashboard visuals.
  });

  test("mobile: confirmation toast stays inside the phone viewport after request", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("Mobile"),
      "Phone viewport coverage only (Pixel / iPhone projects).",
    );

    const baseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!supabaseUrl || !serviceRole, "Missing integration env vars.");

    await page.goto("/nicosia/dentistry");
    await dismissCookieConsentIfPresent(page);

    const requestCta = page.getByTestId("finder-manual-request-online-booking").first();
    await expect(requestCta).toBeVisible({ timeout: 25_000 });
    await requestCta.scrollIntoViewIfNeeded();

    const [, res] = await clickRequestAndWaitForVote(page, requestCta);
    expect([200, 201]).toContain(res.status());
    await expectThanksToastOnScreen(page);
  });
});
