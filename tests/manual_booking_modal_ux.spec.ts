// tests/manual_booking_modal_ux.spec.ts
import { test, expect } from "@playwright/test";
import { signInDoctorAndSetCookies } from "./helpers/doctorAuth";

test.describe("Manual booking modal UX", () => {
  test.beforeEach(({}, testInfo) => {
    if (
      testInfo.project.name === "Mobile Safari (iPhone 12)" ||
      testInfo.project.name === "Tablet (iPad)"
    ) {
      testInfo.skip(
        true,
        "Supabase auth redirect to /agenda is flaky on WebKit mobile for E2E.",
      );
    }
  });

  async function openManualModal(page: import("@playwright/test").Page) {
    await signInDoctorAndSetCookies(page);
    await page.goto("/agenda?manual=1");
    await expect(page).toHaveURL(/\/agenda/, { timeout: 15_000 });
    const panel = page.getByTestId("manual-booking-modal-panel");
    await expect(panel).toBeVisible({ timeout: 15_000 });
    return panel;
  }

  test("desktop short viewport: panel scroll keeps title reachable", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 480 });
    const panel = await openManualModal(page);

    const title = page.getByTestId("manual-booking-modal-title");
    await expect(title).toBeVisible();
    await expect(title).toBeInViewport();

    const firstDay = page
      .locator(".rdp-dark")
      .locator("button.rdp-day_available:not([disabled])")
      .first();
    if ((await firstDay.count()) === 0) {
      test.skip(true, "No available days in calendar for manual booking.");
    }
    await firstDay.click();

    const reason = page.getByPlaceholder("Brief reason for this visit");
    await expect(reason).toBeVisible({ timeout: 10_000 });

    await panel.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(reason).toBeInViewport({ timeout: 5000 });

    await panel.evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(title).toBeInViewport({ timeout: 5000 });
    await expect(
      page.getByText(
        /Took a phone call\? Block the slot manually here\. Next time, share your link to save time\./i,
      ),
    ).toBeInViewport();
  });

  test("mobile viewport: panel scroll keeps title reachable", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 640 });
    const panel = await openManualModal(page);

    const title = page.getByTestId("manual-booking-modal-title");
    await expect(title).toBeVisible();
    await expect(title).toBeInViewport();

    const firstDay = page
      .locator(".rdp-dark")
      .locator("button.rdp-day_available:not([disabled])")
      .first();
    if ((await firstDay.count()) === 0) {
      test.skip(true, "No available days in calendar for manual booking.");
    }
    await firstDay.click();

    const reason = page.getByPlaceholder("Brief reason for this visit");
    await expect(reason).toBeVisible({ timeout: 10_000 });

    await panel.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(reason).toBeInViewport({ timeout: 5000 });

    await panel.evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(title).toBeInViewport({ timeout: 5000 });
  });
});
