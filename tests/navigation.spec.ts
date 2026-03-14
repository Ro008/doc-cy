// tests/navigation.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Navigation and routing", () => {
  test("invalid doctor slug redirects to home", async ({ page }) => {
    await page.goto("/invalid-doctor-slug-xyz");

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: /Smart Medical Appointments/i })
    ).toBeVisible({ timeout: 5000 });
  });
});
