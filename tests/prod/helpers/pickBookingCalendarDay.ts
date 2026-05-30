import { expect, type Page } from "@playwright/test";

const MAX_MONTH_ADVANCES = 4;

/**
 * Picks the first bookable day on the public profile calendar (.rdp-day_available).
 * Advances months when the current view has no availability (common on prod smoke doctors).
 */
export async function pickFirstAvailableBookingDay(page: Page): Promise<void> {
  const calendar = page.locator(".rdp-dark");
  await expect(calendar).toBeVisible({ timeout: 20_000 });

  const pausedCopy = page.getByText(
    /online bookings.*paused|holiday|not accepting.*bookings/i
  );
  if (await pausedCopy.isVisible().catch(() => false)) {
    const hint = (await pausedCopy.first().textContent())?.trim() || "booking paused";
    throw new Error(
      `Prod smoke doctor has no bookable calendar: ${hint}. ` +
        "Check agenda settings (weekly schedule, pause online bookings, holiday mode) for TEST_BOOKING_DOCTOR_SLUG."
    );
  }

  const availableDay = calendar.locator(
    "button.rdp-day_available:not([disabled])"
  );
  const nextMonth = calendar.locator("button.rdp-nav_button_next");

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
    `No available booking days after advancing ${MAX_MONTH_ADVANCES} months. ` +
      "Ensure TEST_BOOKING_DOCTOR_SLUG has enabled weekdays, future horizon, and is not on holiday/pause."
  );
}
