import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "../lib/appointments";
import { signInDoctorAndSetCookies } from "./helpers/doctorAuth";

test.describe("Doctor action feedback toasts", () => {
  test("confirming a requested appointment shows success toast", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    expect(supabaseUrl).not.toBe("");
    expect(supabaseAnonKey).not.toBe("");
    expect(serviceKey).not.toBe("");

    const anon = createClient(supabaseUrl, supabaseAnonKey);
    const admin = createClient(supabaseUrl, serviceKey);

    const { authUserId } = await signInDoctorAndSetCookies(page, anon);
    const { data: doctorRow } = await anon
      .from("doctors")
      .select("id")
      .eq("auth_user_id", authUserId)
      .eq("status", "verified")
      .single();
    const doctorId = (doctorRow as { id?: string } | null)?.id;
    expect(doctorId).toBeTruthy();

    const nonce = Date.now().toString().slice(-6);
    const appointmentLocal = "2030-04-10T10:00";
    const appointmentUtc = zonedTimeToUtc(appointmentLocal, CY_TZ as string);

    const inserted = await admin
      .from("appointments")
      .insert({
        doctor_id: doctorId,
        patient_name: `Toast Confirm ${nonce}`,
        patient_email: `toast.confirm.${nonce}@example.com`,
        patient_phone: "+35799123456",
        appointment_datetime: appointmentUtc.toISOString(),
        status: "REQUESTED",
        reason: "E2E verify success toast on confirm",
        visit_type: null,
        visit_notes: null,
      })
      .select("id")
      .single();

    expect(inserted.error).toBeNull();
    const appointmentId = inserted.data?.id as string | undefined;
    expect(appointmentId).toBeTruthy();

    try {
      await page.route(
        new RegExp(`/api/appointments/${appointmentId}/overlap\\?`),
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ hasConflict: false }),
          });
        },
      );

      await page.route(
        new RegExp(`/api/appointments/${appointmentId}/confirm$`),
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true, message: "Appointment confirmed." }),
          });
        },
      );

      await page.goto(`/dashboard/appointments/${appointmentId}`);
      await expect(
        page.getByRole("button", { name: /Confirm appointment/i }),
      ).toBeVisible({ timeout: 15_000 });

      await page.getByRole("button", { name: /Confirm appointment/i }).click();

      await expect(
        page.getByText(/Appointment confirmed\. Returning to agenda/i),
      ).toBeVisible({ timeout: 8_000 });
      await expect(page).toHaveURL(/\/agenda/, { timeout: 10_000 });
    } finally {
      if (appointmentId) {
        await admin.from("appointments").delete().eq("id", appointmentId);
      }
    }
  });
});
