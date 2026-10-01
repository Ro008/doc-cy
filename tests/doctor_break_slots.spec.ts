// tests/doctor_break_slots.spec.ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInDoctorAndSetCookies } from "./helpers/doctorAuth";
import { pickFirstAvailableBookingDay } from "./helpers/pickBookingCalendarDay";
import { skipIfSafeNoBooking } from "./helpers/safeMode";

test.describe("Doctor lunch/break time", () => {
  test.beforeEach(({}, testInfo) => {
    if (
      testInfo.project.name === "Tablet (iPad)" ||
      testInfo.project.name === "Mobile Safari (iPhone 12)"
    ) {
      testInfo.skip(
        true,
        "Supabase auth redirect to /agenda is flaky on WebKit mobile for E2E.",
      );
    }
  });

  test("break window hides slots between 14:00 and 16:00", async ({ page }) => {
    skipIfSafeNoBooking(test.info());

    test.setTimeout(60000);

    // 0. Sign in programmatically and set Supabase auth cookies.
    // This avoids flakiness when the login form submit isn't intercepted by React.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    expect(supabaseUrl).not.toBe("");
    expect(supabaseAnonKey).not.toBe("");
    expect(supabaseServiceRole).not.toBe("");

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const admin = createClient(supabaseUrl, supabaseServiceRole);
    const { authUserId } = await signInDoctorAndSetCookies(page, supabase);

    // Service role: the anon client's RLS read right after sign-in can come back empty.
    const { data: doctorRow } = await admin
      .from("professionals")
      .select("id, slug")
      .eq("auth_user_id", authUserId)
      .eq("status", "verified")
      .single();

    const doctorId = (doctorRow as { id?: string } | null)?.id;
    const slug = doctorRow?.slug;
    expect(doctorId).toBeTruthy();
    expect(slug).toBeTruthy();

    // Breaks are per clinic since D4 (professional_clinics), not in professional_settings.
    const { data: links, error: linksErr } = await admin
      .from("professional_clinics")
      .select("id, break_start, break_end")
      .eq("professional_id", doctorId);
    expect(linksErr).toBeNull();
    expect(links?.length ?? 0).toBeGreaterThan(0);
    const setBreaks = async (
      rows: {
        id: string;
        break_start: string | null;
        break_end: string | null;
      }[],
    ) => {
      for (const row of rows) {
        const { error } = await admin
          .from("professional_clinics")
          .update({ break_start: row.break_start, break_end: row.break_end })
          .eq("id", row.id);
        expect(error).toBeNull();
      }
    };
    await setBreaks(
      links!.map((row) => ({
        id: row.id,
        break_start: "14:00:00",
        break_end: "16:00:00",
      })),
    );

    try {
      // Go to doctor profile and verify no slots are shown in 14:00–16:00
      await page.goto(`/${slug}`);

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
        timeout: 10000,
      });

      await pickFirstAvailableBookingDay(page, {
        doctorHint: slug ?? undefined,
      });

      // Wait for slots to load
      const selectButtons = page.getByRole("button", { name: /Select/i });
      await expect(selectButtons.first()).toBeVisible({ timeout: 10000 });

      // Assert that no slot label contains 14:00/14:30/15:00/15:30
      for (const t of ["14:00", "14:30", "15:00", "15:30"]) {
        await expect(
          page.getByRole("button", { name: new RegExp(t) }),
        ).toHaveCount(0);
      }
    } finally {
      // The fixture doctor is shared: put their breaks back.
      await setBreaks(links!);
    }
  });
});
