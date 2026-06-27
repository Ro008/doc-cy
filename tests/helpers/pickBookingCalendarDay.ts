import { expect, type Page } from "@playwright/test";

const MAX_MONTH_ADVANCES = 4;

type PickDayOptions = {
  /** Shown in errors (e.g. doctor slug or TEST_BOOKING_DOCTOR_SLUG). */
  doctorHint?: string;
};

/**
 * Picks the first bookable day on the public profile calendar (.rdp-day_available).
 * Supports light (public profile) and dark (agenda manual booking) calendar themes.
 * Advances months when the current view has no availability.
 */
export async function pickFirstAvailableBookingDay(
  page: Page,
  opts?: PickDayOptions
): Promise<void> {
  const doctorHint = opts?.doctorHint?.trim() || "this doctor";
  const calendar = page.locator(".rdp-light, .rdp-dark").first();
  await expect(calendar).toBeVisible({ timeout: 20_000 });

  const pausedCopy = page.getByText(
    /online bookings.*paused|holiday|not accepting.*bookings|temporarily unavailable|no available times/i
  );
  if (await pausedCopy.isVisible().catch(() => false)) {
    const hint = (await pausedCopy.first().textContent())?.trim() || "booking unavailable";
    throw new Error(
      `No bookable calendar for ${doctorHint}: ${hint}. ` +
        "Check weekly schedule, pause online bookings, and holiday mode."
    );
  }

  const availableDay = calendar.locator(
    "button.rdp-day_available:not([disabled])"
  );
  const nextMonth = calendar.getByRole("button", { name: /next month/i });

  for (let month = 0; month <= MAX_MONTH_ADVANCES; month++) {
    const count = await availableDay.count();
    if (count > 0) {
      await availableDay.first().click();
      return;
    }
    if (month < MAX_MONTH_ADVANCES) {
      await expect(nextMonth).toBeVisible({ timeout: 5_000 });
      await nextMonth.click();
    }
  }

  throw new Error(
    `No available booking days for ${doctorHint} after advancing ${MAX_MONTH_ADVANCES} months. ` +
      "Ensure enabled weekdays, booking horizon, and no holiday/pause blocking the calendar."
  );
}
