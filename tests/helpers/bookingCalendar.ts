import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The public booking calendar. Since 2026-10-11 it opens on the first day with times, so the
 * "Select a date on the calendar" placeholder is gone; the calendar itself is the sign that the
 * booking box is there. `.rdp-light` is the older form, so the nightly production smoke works
 * whichever version is deployed.
 */
export const BOOKING_CALENDAR_SELECTOR = ".rdp-profile, .rdp-light";

export function bookingCalendar(page: Page): Locator {
  return page.locator(BOOKING_CALENDAR_SELECTOR).first();
}

export function isBookingCalendarVisible(page: Page): Promise<boolean> {
  return bookingCalendar(page).isVisible();
}

export async function expectBookingCalendar(page: Page, timeout = 10_000): Promise<void> {
  await expect(bookingCalendar(page)).toBeVisible({ timeout });
}

/** The button after picking a time: "Book this time" on the profile ("Continue" / "Confirm" elsewhere). */
export function continueButton(page: Page): Locator {
  return page.getByRole("button", { name: /^(Book this time|Continue|Confirm)$/ }).first();
}
