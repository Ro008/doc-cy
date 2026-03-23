// tests/doctor_break_slots.spec.ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInDoctorAndSetCookies } from "./helpers/doctorAuth";
import { skipIfSafeNoBooking } from "./helpers/safeMode";

test.describe("Doctor lunch/break time", () => {
  test.beforeEach(({}, testInfo) => {
    if (
      testInfo.project.name === "Tablet (iPad)" ||
      testInfo.project.name === "Mobile Safari (iPhone 12)"
    ) {
      testInfo.skip(
        true,
        "Supabase auth redirect to /agenda is flaky on WebKit mobile for E2E."
      );
    }
  });

  test("break window hides slots between 14:00 and 16:00", async ({
    page,
  }) => {
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

    const { data: doctorRow } = await supabase
      .from("doctors")
      .select("id, slug")
      .eq("auth_user_id", authUserId)
      .eq("status", "verified")
      .single();

    const doctorId = (doctorRow as { id?: string } | null)?.id;
    const slug = doctorRow?.slug;
    expect(doctorId).toBeTruthy();
    expect(slug).toBeTruthy();

    // Configure break directly in doctor_settings to avoid mutating profile fields.
    const { error: upsertErr } = await admin.from("doctor_settings").upsert(
      {
        doctor_id: doctorId,
        break_start: "14:00:00",
        break_end: "16:00:00",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "doctor_id" }
    );
    expect(upsertErr).toBeNull();

    // Go to doctor profile and verify no slots are shown in 14:00–16:00
    await page.goto(`/${slug}`);

    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 10000 });

    // Select first available date in the calendar
    await expect(
      page.getByText("Select a date on the calendar")
    ).toBeVisible({ timeout: 10000 });

    const calendar = page.locator(".rdp-dark");
    const firstAvailableDay = calendar
      .locator("table button:not([disabled])")
      .first();
    await expect(firstAvailableDay).toBeVisible({ timeout: 5000 });
    await firstAvailableDay.click();

    // Wait for slots to load
    const selectButtons = page.getByRole("button", { name: /Select/i });
    await expect(selectButtons.first()).toBeVisible({ timeout: 10000 });

    // Assert that no slot label contains 14:00/14:30/15:00/15:30
    for (const t of ["14:00", "14:30", "15:00", "15:30"]) {
      await expect(
        page.getByRole("button", { name: new RegExp(t) })
      ).toHaveCount(0);
    }
  });
});

