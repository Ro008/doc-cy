import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { addHours, format } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";

function monthDiffInclusive(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

test.describe("Scheduling boundaries UI (read-only)", () => {
  test("respects booking horizon and minimum notice in public calendar", async ({
    page,
  }) => {
    const targetSlug =
      process.env.DOCTOR_SLUG?.trim() ||
      process.env.PLAYWRIGHT_DOCTOR_SLUG?.trim() ||
      "andreas-nikos";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    test.skip(!supabaseUrl || !supabaseAnonKey, "Missing Supabase env vars.");

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: doctor } = await supabase
      .from("doctors")
      .select("id,slug,status")
      .eq("slug", targetSlug)
      .single();
    test.skip(
      !doctor?.id || doctor.status !== "verified",
      `Verified doctor not found for slug: ${targetSlug}.`
    );

    const { data: settings } = await supabase
      .from("doctor_settings")
      .select("booking_horizon_days, minimum_notice_hours")
      .eq("doctor_id", doctor.id)
      .single();
    test.skip(!settings, "No doctor_settings row found.");

    const horizonDays =
      [14, 30, 90, 180].includes(Number(settings.booking_horizon_days))
        ? Number(settings.booking_horizon_days)
        : 90;
    const noticeHours =
      [1, 2, 12, 24].includes(Number(settings.minimum_notice_hours))
        ? Number(settings.minimum_notice_hours)
        : 2;

    await page.goto(`/${doctor.slug}`);
    await expect(page.getByText("Select a date on the calendar")).toBeVisible({
      timeout: 10000,
    });

    // 1) Booking horizon boundary via calendar navigation limits
    const nowCy = utcToZonedTime(new Date(), CY_TZ);
    const maxCy = utcToZonedTime(
      new Date(nowCy.getTime() + horizonDays * 24 * 60 * 60 * 1000),
      CY_TZ
    );
    const monthsToBoundary = Math.max(0, monthDiffInclusive(nowCy, maxCy));

    const nextMonthBtn = page.getByRole("button", {
      name: /Go to next month/i,
    });
    await expect(nextMonthBtn).toBeVisible({ timeout: 10000 });
    for (let i = 0; i < monthsToBoundary; i++) {
      if (await nextMonthBtn.isDisabled()) break;
      await nextMonthBtn.click();
    }
    await expect(nextMonthBtn).toBeDisabled({ timeout: 5000 });

    // 2) Minimum notice boundary for today (if today has available slots)
    const todayBtn = page
      .locator("button[aria-current='date']:not([disabled])")
      .first();
    if (await todayBtn.count()) {
      await todayBtn.click();
      const slotButtons = page.getByRole("button", { name: /Select|Selected/i });
      if ((await slotButtons.count()) > 0) {
        const earliestAllowed = format(
          utcToZonedTime(addHours(new Date(), noticeHours), CY_TZ),
          "HH:mm"
        );
        const allTexts = await slotButtons.allTextContents();
        const slotTimes = allTexts
          .map((t) => t.match(/\b([01]\d|2[0-3]):[0-5]\d\b/)?.[0] ?? null)
          .filter((v): v is string => Boolean(v));

        // All visible slots for "today" must satisfy minimum notice.
        for (const t of slotTimes) {
          expect(t >= earliestAllowed).toBeTruthy();
        }
      }
    }
  });
});

