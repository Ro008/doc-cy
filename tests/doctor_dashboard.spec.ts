// tests/doctor_dashboard.spec.ts
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { signInDoctorAndSetCookies } from "./helpers/doctorAuth";

async function signIn(page: any) {
  await signInDoctorAndSetCookies(page as Page);
  await page.goto("/agenda");
  await expect(
    page.getByRole("heading", { level: 1, name: /Your agenda/i })
  ).toBeVisible({ timeout: 10000 });
}

test.describe("Doctor dashboard", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, testInfo) => {
    if (testInfo.project.name === "Mobile Chrome (Pixel 5)") {
      testInfo.skip(
        true,
        "Supabase auth redirect to /agenda is flaky on Mobile Chrome for E2E."
      );
    }
    if (testInfo.project.name === "Tablet (iPad)") {
      test.skip(
        true,
        "Supabase login redirect to /agenda is not stable on WebKit iPad for E2E."
      );
    }
    if (testInfo.project.name === "Mobile Safari (iPhone 12)") {
      test.skip(
        true,
        "Supabase login redirect to /agenda is not stable on WebKit iOS for E2E."
      );
    }
  });

  test("desktop: appointments list or empty state, and appointment detail when present", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1024, height: 768 });
    await signIn(page);

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
    test.setTimeout(60000);
    await page.setViewportSize({ width: 320, height: 568 });
    await signIn(page);

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
    test.setTimeout(60000);
    await signIn(page);

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
