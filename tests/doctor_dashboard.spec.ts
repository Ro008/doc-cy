// tests/doctor_dashboard.spec.ts
import { test, expect } from "@playwright/test";

const E2E_DOCTOR_EMAIL = process.env.E2E_DOCTOR_EMAIL ?? "";
const E2E_DOCTOR_PASSWORD = process.env.E2E_DOCTOR_PASSWORD ?? "";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(E2E_DOCTOR_EMAIL);
  await page.getByLabel(/password/i).fill(E2E_DOCTOR_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/agenda/, { timeout: 10000 });
}

test.describe("Doctor dashboard", () => {
  test("desktop: appointments list or empty state, and appointment detail when present", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/agenda");

    await expect(
      page.getByRole("heading", { level: 1, name: /Your agenda/i })
    ).toBeVisible({ timeout: 10000 });

    const todaySection = page.locator("section").first();
    await expect(todaySection).toBeVisible();

    const appointmentBlocks = todaySection.getByRole("button");
    const count = await appointmentBlocks.count();

    if (count >= 1) {
      await appointmentBlocks.first().click();
      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible({ timeout: 3000 });
      await expect(
        modal.getByRole("link", { name: /Chat on WhatsApp/i })
      ).toBeVisible();
    } else {
      await expect(
        todaySection.getByText(/No appointments today|schedule is clear/i).first()
      ).toBeVisible({ timeout: 3000 });
    }
  });

  test("mobile: stacked list and no overlapping timeline", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/agenda");

    await expect(
      page.getByRole("heading", { level: 1, name: /Your agenda/i })
    ).toBeVisible({ timeout: 10000 });

    // On mobile we show stacked cards, not the desktop timeline
    const todaySection = page.locator("section").first();
    await expect(todaySection).toBeVisible();
    // Either appointment cards (buttons) or empty state text
    const content =
      todaySection.getByRole("button").first().or(
        todaySection.getByText(/No appointments today/).first()
      );
    await expect(content).toBeVisible({ timeout: 5000 });
  });

  test("dashboard links to settings and settings page loads", async ({
    page,
  }) => {
    test.skip(
      !E2E_DOCTOR_EMAIL || !E2E_DOCTOR_PASSWORD,
      "Set E2E_DOCTOR_EMAIL and E2E_DOCTOR_PASSWORD (settings requires auth)"
    );

    await signIn(page);
    await page.goto("/agenda");

    await expect(
      page.getByRole("heading", { level: 1, name: /Your agenda/i })
    ).toBeVisible({ timeout: 10000 });

    const settingsLink = page.getByRole("link", {
      name: /Working hours & settings/i,
    });
    await expect(settingsLink).toBeVisible();
    await expect(settingsLink).toHaveAttribute("href", "/agenda/settings");

    await Promise.all([
      page.waitForURL(/\/agenda\/settings/, { timeout: 10000 }),
      settingsLink.click(),
    ]);
    await expect(page).toHaveURL("/agenda/settings");
    await expect(
      page.getByRole("heading", { name: /Working hours & availability/i })
    ).toBeVisible({ timeout: 5000 });
  });
});
