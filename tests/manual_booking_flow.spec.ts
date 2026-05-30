/**
 * Manual booking E2E. Policy: optional UI fields must have an empty-field case — see
 * docs/ci-test-policy.md § "Optional UI fields (PR tests, Pareto rule)".
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInDoctorOrSkipOnInfraError } from "./helpers/signInDoctorWithInfraSkip";
import { skipIfSafeNoBooking } from "./helpers/safeMode";

test.describe("Manual booking flow @booking-creates", { tag: "@pr-e2e" }, () => {
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

  async function pickFirstAvailableSlot(page: import("@playwright/test").Page) {
    const calendar = page.locator(".rdp-dark").first();
    const firstAvailableDay = calendar
      .locator("button.rdp-day_available:not([disabled])")
      .first();
    if ((await firstAvailableDay.count()) === 0) {
      return null;
    }
    await firstAvailableDay.click();

    const timePanel = page.locator("p", { hasText: /^Time$/i }).locator("..");
    const firstSlot = timePanel
      .locator("button")
      .filter({ hasText: /^\d{2}:\d{2}/ })
      .first();
    await expect(firstSlot).toBeVisible({ timeout: 10_000 });
    const selectedTimeLabel = (await firstSlot.textContent())?.trim() ?? "";
    expect(selectedTimeLabel).toMatch(/^\d{2}:\d{2}$/);
    await firstSlot.click();
    return { firstAvailableDay, timePanel, selectedTimeLabel };
  }

  test("doctor can create manual booking without email or phone", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    skipIfSafeNoBooking(test.info());

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    expect(supabaseUrl).not.toBe("");
    expect(supabaseAnonKey).not.toBe("");
    expect(serviceKey).not.toBe("");

    const admin = createClient(supabaseUrl, serviceKey);
    await signInDoctorOrSkipOnInfraError(page);

    let createdAppointmentId: string | null = null;
    let selectedTimeLabel = "";

    try {
      await page.goto("/agenda?manual=1");
      await expect(page).toHaveURL(/\/agenda/, { timeout: 15_000 });

      const modalTitle = page.getByRole("heading", { name: /\+ Add Manual Booking/i });
      await expect(modalTitle).toBeVisible({ timeout: 15_000 });

      const slotPick = await pickFirstAvailableSlot(page);
      if (!slotPick) {
        test.skip(true, "No available days found for manual booking.");
      }
      const { firstAvailableDay, timePanel } = slotPick;
      selectedTimeLabel = slotPick.selectedTimeLabel;

      const nonce = Date.now().toString().slice(-6);
      const patientName = `Manual E2E ${nonce}`;

      await page.getByPlaceholder("Patient full name").fill(patientName);
      await page
        .getByPlaceholder("Brief reason for this visit")
        .fill("Manual booking created from phone call in E2E validation.");

      const confirmButton = page.getByRole("button", { name: /Confirm Booking/i });
      await expect(confirmButton).toBeEnabled();
      await confirmButton.click();

      await expect(
        page.getByRole("heading", { name: /Appointment Blocked!/i }),
      ).toBeVisible({ timeout: 15_000 });

      const googleLink = page.getByRole("link", { name: /Add to Google/i });
      await expect(googleLink).toBeVisible();
      await expect(googleLink).toHaveAttribute("href", /calendar\.google\.com/);

      const iCalLink = page.getByRole("link", { name: /Add to iCal/i });
      await expect(iCalLink).toBeVisible();
      const iCalHref = await iCalLink.getAttribute("href");
      expect(iCalHref ?? "").toMatch(/\/api\/appointments\/[^/]+\/calendar/);

      const appointmentIdMatch = (iCalHref ?? "").match(
        /\/api\/appointments\/([^/]+)\/calendar/,
      );
      createdAppointmentId = appointmentIdMatch?.[1] ?? null;
      expect(createdAppointmentId).toBeTruthy();

      await expect(
        page.getByRole("link", { name: /Share Link via WhatsApp/i }),
      ).toHaveCount(0);

      await page.getByRole("button", { name: /^Done$/i }).click();
      await expect(modalTitle).toHaveCount(0);

      await page.reload();
      await expect(page).toHaveURL(/\/agenda/, { timeout: 10_000 });

      await expect(modalTitle).toBeVisible({ timeout: 10_000 });
      await firstAvailableDay.click();
      const sameTimeSlot = timePanel
        .locator("button")
        .filter({ hasText: new RegExp(`^${selectedTimeLabel}\\b`) })
        .first();
      await expect(sameTimeSlot).toBeVisible({ timeout: 10_000 });
      await sameTimeSlot.click();

      await page.getByPlaceholder("Patient full name").fill(`${patientName} Duplicate`);
      await page
        .getByPlaceholder("Brief reason for this visit")
        .fill("Trying to rebook same slot should fail.");

      await page.getByRole("button", { name: /Confirm Booking/i }).click();
      await expect(page.getByText(/Slot already taken/i)).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      if (createdAppointmentId) {
        await admin.from("appointments").delete().eq("id", createdAppointmentId);
      }
    }
  });

  test("manual booking success shows WhatsApp when patient phone provided", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    skipIfSafeNoBooking(test.info());

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    expect(supabaseUrl).not.toBe("");
    expect(serviceKey).not.toBe("");

    const admin = createClient(supabaseUrl, serviceKey);
    await signInDoctorOrSkipOnInfraError(page);

    let createdAppointmentId: string | null = null;

    try {
      await page.goto("/agenda?manual=1");
      await expect(page).toHaveURL(/\/agenda/, { timeout: 15_000 });

      const slotPick = await pickFirstAvailableSlot(page);
      if (!slotPick) {
        test.skip(true, "No available days found for manual booking.");
      }

      const nonce = Date.now().toString().slice(-6);
      const patientPhone = "+35799123456";

      await page.getByPlaceholder("Patient full name").fill(`Manual WA ${nonce}`);
      await page.getByPlaceholder("+357...").fill(patientPhone);
      await page
        .getByPlaceholder("Brief reason for this visit")
        .fill("Manual booking with phone for WhatsApp share.");

      await page.getByRole("button", { name: /Confirm Booking/i }).click();

      await expect(
        page.getByRole("heading", { name: /Appointment Blocked!/i }),
      ).toBeVisible({ timeout: 15_000 });

      const whatsappLink = page.getByRole("link", {
        name: /Share Link via WhatsApp/i,
      });
      await expect(whatsappLink).toBeVisible();
      await expect(whatsappLink).toHaveAttribute("href", /wa\.me\/35799123456/);
      await expect(whatsappLink).toHaveAttribute(
        "href",
        /For%20future%20bookings/i,
      );

      const iCalHref = await page
        .getByRole("link", { name: /Add to iCal/i })
        .getAttribute("href");
      const appointmentIdMatch = (iCalHref ?? "").match(
        /\/api\/appointments\/([^/]+)\/calendar/,
      );
      createdAppointmentId = appointmentIdMatch?.[1] ?? null;
    } finally {
      if (createdAppointmentId) {
        await admin.from("appointments").delete().eq("id", createdAppointmentId);
      }
    }
  });
});
