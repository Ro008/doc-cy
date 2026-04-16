// tests/booking_flow.spec.ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { skipIfSafeNoBooking } from "./helpers/safeMode";

test.describe("Booking flow @booking-creates", () => {
  test("full booking flow on doctor profile", async ({ page, request }) => {
    skipIfSafeNoBooking(test.info());

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    expect(supabaseUrl).not.toBe("");
    expect(supabaseAnonKey).not.toBe("");

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const admin = serviceKey ? createClient(supabaseUrl, serviceKey) : null;
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const fallbackDoctorEmail = `booking-flow-${nonce}@integration.test`;
    const fallbackDoctorSlug = `booking-flow-${nonce}`;
    let fallbackAuthUserId = "";
    let fallbackDoctorId = "";
    const { data: activeDoctors } = await supabase
      .from("doctors")
      .select("slug,name,id")
      .eq("status", "verified")
      .limit(8);

    const doctors = activeDoctors ?? [];
    let chosenDoctor: (typeof doctors)[number] | null = null;

    for (const d of doctors) {
      if (!d?.slug) continue;
      await page.goto(`/${d.slug}`);
      // If the doctor has no published availability yet, BookingSection hides the calendar.
      if (await page.getByText("Select a date on the calendar").isVisible()) {
        chosenDoctor = d;
        break;
      }
    }

    if (!chosenDoctor) {
      if (!admin) {
        throw new Error(
          "No verified doctor with published availability found for E2E."
        );
      }

      const createUserRes = await admin.auth.admin.createUser({
        email: fallbackDoctorEmail,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (createUserRes.error || !createUserRes.data.user?.id) {
        throw new Error(
          `No verified doctor found and failed creating fallback auth user: ${createUserRes.error?.message}`
        );
      }
      fallbackAuthUserId = createUserRes.data.user.id;

      const doctorInsert = await admin
        .from("doctors")
        .insert({
          auth_user_id: fallbackAuthUserId,
          name: `Booking Flow Doctor ${nonce}`,
          specialty: "General Practice",
          email: fallbackDoctorEmail,
          phone: "+35799123456",
          languages: ["English"],
          license_number: `LIC-BFLOW-${nonce}`,
          license_file_url: `licenses/integration/${nonce}.pdf`,
          status: "verified",
          slug: fallbackDoctorSlug,
          is_specialty_approved: true,
          subscription_tier: "standard",
        })
        .select("id,slug,name")
        .single();
      if (doctorInsert.error || !doctorInsert.data?.id) {
        throw new Error(
          `No verified doctor found and failed creating fallback doctor: ${doctorInsert.error?.message}`
        );
      }
      fallbackDoctorId = String(doctorInsert.data.id);

      const day = { enabled: true, start_time: "09:00:00", end_time: "17:00:00" };
      const settingsUpsert = await admin.from("doctor_settings").upsert(
        {
          doctor_id: fallbackDoctorId,
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false,
          start_time: "09:00:00",
          end_time: "17:00:00",
          weekly_schedule: {
            monday: day,
            tuesday: day,
            wednesday: day,
            thursday: day,
            friday: day,
            saturday: { enabled: false, start_time: "09:00:00", end_time: "17:00:00" },
            sunday: { enabled: false, start_time: "09:00:00", end_time: "17:00:00" },
          },
          break_start: null,
          break_end: null,
          holiday_mode_enabled: false,
          holiday_start_date: null,
          holiday_end_date: null,
          pause_online_bookings: false,
          slot_duration_minutes: 30,
          booking_horizon_days: 90,
          minimum_notice_hours: 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "doctor_id" }
      );
      if (settingsUpsert.error) {
        throw new Error(
          `No verified doctor found and failed creating fallback settings: ${settingsUpsert.error.message}`
        );
      }

      chosenDoctor = {
        id: fallbackDoctorId,
        slug: fallbackDoctorSlug,
        name: `Booking Flow Doctor ${nonce}`,
      };
      await page.goto(`/${chosenDoctor.slug}`);
      await expect(page.getByText("Select a date on the calendar")).toBeVisible({
        timeout: 10000,
      });
    }

    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 10000 });

    // 1. Verify we actually loaded the doctor profile (not the landing page).
    // If the doctor is missing/inactive, the doctor page redirects to "/".
    await expect(page).toHaveURL(new RegExp(`/${chosenDoctor.slug}$`), {
      timeout: 10000,
    });
    await expect(
      page.getByText(/Evangelismos Private Hospital/i)
    ).toBeVisible({ timeout: 10000 });

    // 2. Two-column booking: wait for panel (unique placeholder), then select first available day
    await expect(
      page.getByText("Select a date on the calendar")
    ).toBeVisible({ timeout: 10000 });
    const calendar = page.locator(".rdp-dark");
    const firstAvailableDay = calendar
      .locator("table button:not([disabled])")
      .first();
    await expect(firstAvailableDay).toBeVisible({ timeout: 5000 });
    await firstAvailableDay.click();

    // 3. Select a time slot, then Confirm (use different slot per worker to avoid 409)
    const selectSlotBtn = page.getByRole("button", { name: /Select/i });
    await expect(selectSlotBtn.first()).toBeVisible({ timeout: 5000 });
    const slotIndex = Math.min(
      test.info().parallelIndex ?? 0,
      (await selectSlotBtn.count()) - 1
    );
    await selectSlotBtn.nth(slotIndex).click();
    await page.getByRole("button", { name: /Confirm/i }).first().click();

    // 4. Contact form
    const nameInput = page.getByLabel("Full name", { exact: true });
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Jane Smith");

    const emailInput = page.getByLabel("Email", { exact: true });
    await expect(emailInput).toBeVisible();
    await emailInput.fill("jane.smith@example.com");

    const phoneInput = page.getByRole("textbox", {
      name: /Phone.*priority contact/i,
    });
    await expect(phoneInput).toBeVisible();
    await phoneInput.click();
    await phoneInput.pressSequentially("99123456", { delay: 50 });

    // Wait for phone validation to pass (error message disappears)
    await expect(
      page.getByText(/Please enter a valid phone number|double‑check the phone number length/i)
    ).toBeHidden({ timeout: 3000 });

    await page.locator("#visitReason").fill("Routine check-up — E2E booking flow.");

    // 5. Submit booking
    const submitBtn = page.getByRole("button", {
      name: /Send booking request/i,
    });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 6. Assert success page + extract appointmentId for teardown
    // If another worker books the same slot between selection and insert,
    // the UI shows an inline 409 error and we need to retry with a different slot.
    // Localized routes: /{locale}/{slug}/request-sent (localePrefix: "always")
    const successUrlRegex = new RegExp(
      `/(?:en|el)/${chosenDoctor.slug}/request-sent[?]appointmentId=`,
    );

    try {
      await page.waitForURL(successUrlRegex, { timeout: 25000 });
    } catch {
      await expect(page.getByTestId("booking-error-message")).toBeVisible({
        timeout: 5000,
      });

      const changeTimeBtn = page.getByRole("button", { name: /Change time/i });
      await expect(changeTimeBtn).toBeVisible({ timeout: 10000 });
      await changeTimeBtn.click();

      const selectButtons = page.getByRole("button", { name: /Select/i });
      const count = await selectButtons.count();
      expect(count).toBeGreaterThan(0);

      await selectButtons.nth((slotIndex + 1) % count).click();
      await page.getByRole("button", { name: /Confirm/i }).first().click();
      await page.locator("#visitReason").fill("Routine check-up — E2E booking flow.");
      await page.getByRole("button", { name: /Send booking request/i }).click();

      await page.waitForURL(successUrlRegex, { timeout: 25000 });
    }
    await expect(page.getByTestId("booking-request-sent-page")).toBeVisible({
      timeout: 15000,
    });

    const url = new URL(page.url());
    const appointmentId = url.searchParams.get("appointmentId") ?? "";
    expect(appointmentId).not.toBe("");

    // 7. .ics is only offered after the professional confirms the request
    await expect(
      page.getByRole("link", { name: /Download \.ics/i })
    ).toHaveCount(0);

    if (serviceKey) {
      await admin.from("appointments").delete().eq("id", appointmentId);
    }

    if (admin && fallbackDoctorId) {
      await admin.from("doctor_settings").delete().eq("doctor_id", fallbackDoctorId);
      await admin.from("doctors").delete().eq("id", fallbackDoctorId);
      if (fallbackAuthUserId) {
        await admin.auth.admin.deleteUser(fallbackAuthUserId);
      }
    }
  });
});
