// tests/landing.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("displays main headline and primary CTA", async ({ page }) => {
    await page.goto("/");

    // Main headline: "Your medical practice, automated."
    await expect(
      page.getByRole("heading", { level: 1, name: /Your medical practice/i })
    ).toBeVisible();

    // Primary CTA: "Create Your Professional Profile" → /register
    const primaryCta = page.getByRole("link", {
      name: /Create Your Professional Profile/i,
    });
    await expect(primaryCta).toBeVisible();
    await expect(primaryCta).toHaveAttribute("href", "/register");

    // Secondary: "Doctor Portal" → /login
    const doctorPortal = page.getByRole("link", { name: /Doctor Portal/i });
    await expect(doctorPortal).toBeVisible();
    await expect(doctorPortal).toHaveAttribute("href", "/login");
  });

  test("primary CTA navigates to register", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", {
      name: /Create Your Professional Profile/i,
    });
    await expect(cta).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/register/, { timeout: 10000 }),
      cta.click(),
    ]);

    await expect(page).toHaveURL("/register");
    await expect(
      page.getByRole("heading", { name: /Create your professional profile/i })
    ).toBeVisible({ timeout: 5000 });
  });
});
