// tests/landing.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("displays main headline and primary CTA", async ({ page }) => {
    await page.goto("/");

    // Main headline: "Smart Medical Appointments in Cyprus"
    await expect(
      page.getByRole("heading", { name: /Smart Medical Appointments/i })
    ).toBeVisible();
    await expect(page.getByText(/in Cyprus/).first()).toBeVisible();

    // Primary CTA: "Book with Dr. Nikos"
    const cta = page.getByRole("link", { name: /Book with Dr. Nikos/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/dr-nikos");
  });

  test("primary CTA navigates to doctor profile", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: /Book with Dr. Nikos/i });
    await expect(cta).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/dr-nikos/, { timeout: 10000 }),
      cta.click(),
    ]);

    await expect(
      page.getByText("Dr. Andreas Nikos", { exact: true })
    ).toBeVisible({ timeout: 5000 });
  });
});
