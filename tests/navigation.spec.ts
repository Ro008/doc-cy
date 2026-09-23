// tests/navigation.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Navigation and routing", { tag: ["@pr-e2e", "@pr-e2e-finder"] }, () => {
  test("invalid doctor slug shows a 404 instead of the finder home", async ({ page }) => {
    const response = await page.goto("/invalid-doctor-slug-xyz");

    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL(/\/en\/invalid-doctor-slug-xyz\/?$/);
    await expect(page.getByText(/this page could not be found/i)).toBeVisible();
  });

  test("for-professionals Find a Professional opens patient home", async ({ page }) => {
    await page.goto("/for-professionals");

    const finderLink = page.getByRole("link", { name: /^Find a Professional$/i }).first();
    await expect(finderLink).toBeVisible();
    await finderLink.click();

    await expect(page).toHaveURL(/^https?:\/\/[^/?#]+\/?(?:\?.*)?$/, { timeout: 60_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: /The most complete health directory in Cyprus|Cyprus['’]s most complete health directory|Find your next health professional(?: in Cyprus)?|Health Professionals in Cyprus|Find a Professional/i })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("article").first()).toBeVisible({ timeout: 30_000 });
    const resultsCount = page.getByTestId("finder-results-count");
    await expect(resultsCount).toBeVisible({ timeout: 30_000 });
    await expect(resultsCount).toContainText(/health professionals on DocCy across Cyprus/i);
    await expect(resultsCount).toContainText(/\d+/);
    await expect(page.getByTestId("finder-missing-doctor-card")).toHaveCount(0);
  });

  test("patient home without filters does not show filtered-empty message", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/^https?:\/\/[^/?#]+\/?(?:\?.*)?$/, { timeout: 60_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: /The most complete health directory in Cyprus|Cyprus['’]s most complete health directory|Find your next health professional(?: in Cyprus)?|Health Professionals in Cyprus|Find a Professional/i })
    ).toBeVisible({ timeout: 30_000 });

    await expect(page.getByTestId("finder-missing-doctor-card")).toHaveCount(0);
  });

  test("finder header links to Join as a professional register", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    const header = page.getByTestId("finder-public-header");
    await expect(header).toBeVisible({ timeout: 30_000 });

    const joinLink = header.getByRole("link", { name: /join as a professional/i });
    const loginLink = header.getByRole("link", { name: /practitioner login/i });
    await expect(joinLink).toHaveAttribute("href", "/register");
    await expect(loginLink).toHaveAttribute("href", "/login");

    await Promise.all([
      page.waitForURL(/\/register\/?$/, { timeout: 30_000 }),
      joinLink.click(),
    ]);
    await expect(
      page.getByRole("heading", { level: 1, name: /Join DocCy in 3 steps/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /^Sign in$/i })).toHaveAttribute("href", "/login");
  });

  test("doctor profile header links to Join as a professional register", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const profileLink = page
      .locator("section.mt-6 article")
      .first()
      .getByRole("link")
      .first();
    await expect(profileLink).toBeVisible({ timeout: 30_000 });

    await Promise.all([
      page.waitForURL(/\/(?:en|el)\/[^/?#]+\/?(?:[?#].*)?$/, { timeout: 30_000 }),
      profileLink.click(),
    ]);

    const header = page.getByTestId("finder-public-header");
    await expect(header).toBeVisible({ timeout: 30_000 });
    await expect(header.getByRole("link", { name: /join as a professional/i })).toHaveAttribute(
      "href",
      "/register",
    );
    await expect(header.getByRole("link", { name: /practitioner login/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  test("finder header shows Join only on mobile; login stays desktop", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const header = page.getByTestId("finder-public-header");
    await expect(header).toBeVisible({ timeout: 30_000 });
    await expect(header.getByTestId("public-header-menu-toggle")).toHaveCount(0);

    const joinLink = header.getByRole("link", { name: /join as a professional/i });
    await expect(joinLink).toBeVisible();
    await expect(joinLink).toHaveAttribute("href", "/register");
    await expect(header.getByRole("link", { name: /practitioner login/i })).toBeHidden();
  });

  test("sales header has no guest CTAs; hero keeps the conversion CTAs", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/for-professionals");

    const header = page.getByTestId("sales-public-header");
    await expect(header).toBeVisible({ timeout: 30_000 });
    await expect(header.getByTestId("public-header-menu-toggle")).toHaveCount(0);
    await expect(header.getByRole("link", { name: /join as a professional/i })).toHaveCount(0);

    await expect(page.getByRole("link", { name: /list my practice/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /practitioner login/i }).first()).toBeVisible();
  });

  test("finder 'Are you a healthcare professional?' CTA opens /register", async ({ page }) => {
    await page.goto("/");

    const registerCta = page.getByRole("link", { name: /list your practice/i }).first();
    await expect(registerCta).toBeVisible();
    await expect(registerCta).toHaveAttribute("href", "/register");
    await Promise.all([
      page.waitForURL(/\/register\/?$/, { timeout: 30_000 }),
      registerCta.click(),
    ]);
  });

  test("finder quick links apply filters without stuck loading state", async ({ page }) => {
    await page.goto("/");

    const dentistsQuickLink = page.getByRole("link", { name: "Dentists in Paphos" });
    await expect(dentistsQuickLink).toBeVisible();
    await dentistsQuickLink.click();

    await expect(page).toHaveURL(/\/paphos\/dentist(?:\?|$)/);
    // Client-side transition + results fetch can outrun the default 5s
    // expect timeout under CI/dev load; other nav checks in this file already
    // use an explicit longer timeout for the same reason.
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Dentist in Paphos/i,
      })
    ).toBeVisible({ timeout: 20_000 });
  });

  test("legacy /finder filter URLs redirect to public paths", async ({ page }) => {
    // /finder prefix dropped, then the legacy "dentistry" spelling 308s to the
    // catalogue slug (middleware canonicalFinderSpecialtyRedirectPath).
    await page.goto("/finder/paphos/dentistry");
    await expect(page).toHaveURL(/\/paphos\/dentist(?:\?|$)/, { timeout: 20_000 });
  });

  test("clinics search is reachable from homepage toggle and footer", async ({ page }) => {
    await page.goto("/");

    const toggle = page.getByTestId("finder-audience-toggle");
    await expect(toggle).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/clinics(?:\?|$)/, { timeout: 30_000 }),
      toggle.getByRole("link", { name: /^Clinics$/i }).click(),
    ]);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /The largest directory of clinics in Cyprus|The largest clinic directory in Cyprus|Find clinics in Cyprus/i,
      }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByPlaceholder(/Search by clinic name/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Clinic near me/i })).toBeVisible();

    await page.goto("/for-professionals");
    await Promise.all([
      page.waitForURL(/\/clinics(?:\?|$)/, { timeout: 30_000 }),
      page.getByRole("link", { name: /^Find a Clinic$/i }).click(),
    ]);
  });
});
