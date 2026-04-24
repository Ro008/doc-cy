// tests/landing.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("displays main headline and primary CTA", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /stop chasing appointments.*start protecting your time/i,
      }),
    ).toBeVisible();

    const primaryCta = page.getByRole("link", {
      name: /Claim your professional profile/i,
    });
    await expect(primaryCta).toBeVisible();
    await expect(primaryCta).toHaveAttribute("href", "/#founders-pricing");

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
      page.waitForURL(/\/#founders-pricing$/, { timeout: 10000 }),
      cta.click(),
    ]);

    await expect(page).toHaveURL(/\/#founders-pricing$/);
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
});
