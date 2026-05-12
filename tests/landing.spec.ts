// tests/landing.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("displays main headline and primary CTA", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /your professional website\s*&\s*online agenda/i,
      }),
    ).toBeVisible();

    const primaryCta = page.getByRole("link", {
      name: /Claim your professional profile/i,
    });
    await expect(primaryCta).toBeVisible();
    await expect(primaryCta).toHaveAttribute("href", "#founders-pricing-card");

    const professionalLogin = page.getByRole("link", {
      name: /Professional Login/i,
    });
    await expect(professionalLogin).toBeVisible();
    await expect(professionalLogin).toHaveAttribute("href", "/login");
  });

  test("primary CTA navigates to founders pricing section", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", {
      name: /Claim your professional profile/i,
    });
    await expect(cta).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/#founders-pricing-card$/, { timeout: 10000 }),
      cta.click(),
    ]);

    await expect(page).toHaveURL(/\/#founders-pricing-card$/);
    await expect(
      page.getByRole("heading", {
        name: /Special launch pricing for the first 100 practitioners across Cyprus/i,
      }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("priority ranking tooltip stays within viewport on mobile", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("Mobile"), "Mobile-only coverage.");

    await page.goto("/#founders-pricing");

    const infoButton = page.getByRole("button", { name: /priority placement/i }).first();
    await expect(infoButton).toBeVisible({ timeout: 10000 });
    await infoButton.click();

    const tooltip = page.getByRole("tooltip").first();
    await expect(tooltip).toBeVisible();

    const bounds = await tooltip.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, viewportWidth: window.innerWidth };
    });

    expect(bounds.left).toBeGreaterThanOrEqual(4);
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth - 4);
  });

  test("FAQ section shows key objections below pricing", async ({ page }) => {
    await page.goto("/#founders-pricing");

    await expect(
      page.getByRole("heading", {
        name: /Common questions/i,
      }),
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByText(/What if a patient calls me by phone\? Will I have double bookings\?/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Won't a private website give me more visibility than a profile\?/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Can my secretary or team manage the agenda for me\?/i),
    ).toBeVisible();
    await expect(page.getByText(/How long does it take to set up\? I am busy\./i)).toBeVisible();
  });

  test("FAQ accordion reveals answer for double bookings objection", async ({ page }) => {
    await page.goto("/#founders-pricing");

    const faqToggle = page
      .locator("summary")
      .filter({ hasText: /What if a patient calls me by phone\? Will I have double bookings\?/i })
      .first();
    await expect(faqToggle).toBeVisible({ timeout: 10000 });
    await faqToggle.click();

    await expect(page.getByText(/single source of truth/i)).toBeVisible();
    await expect(page.getByText(/slot is instantly blocked on your public profile/i)).toBeVisible();
  });
});
