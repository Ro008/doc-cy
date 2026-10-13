import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "../lib/appointments";
import { signInDoctorAndSetCookies } from "./helpers/doctorAuth";

test.describe("Doctor action feedback toasts", () => {
  test("confirming a requested appointment opens post-confirm summary", async ({
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
    // Service role: with a cached session the sign-in helper never signs in the client it's given,
    // and an anonymous read can't match on auth_user_id.
    const { data: doctorRow } = await admin
      .from("professionals")
      .select("id")
      .eq("auth_user_id", authUserId)
      .eq("is_registered", true)
      .single();
    const doctorId = (doctorRow as { id?: string } | null)?.id;
    expect(doctorId).toBeTruthy();

    const nonce = Date.now().toString().slice(-6);
    const appointmentLocal = "2030-04-10T10:00";
    const appointmentUtc = zonedTimeToUtc(appointmentLocal, CY_TZ as string);

    const inserted = await admin
      .from("appointments")
      .insert({
        professional_id: doctorId,
        patient_name: `Toast Confirm ${nonce}`,
        patient_email: `toast.confirm.${nonce}@integration.test`,
        patient_phone: "+35799123456",
        appointment_datetime: appointmentUtc.toISOString(),
        status: "REQUESTED",
        reason: "E2E verify success toast on confirm",
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

      await page.goto(`/dashboard/appointments/${appointmentId}`);
      // "Confirm Wed 10 Apr, 10:00–10:30"
      const confirmBtn = page.getByRole("button", { name: /^Confirm (Mon|Tue|Wed|Thu|Fri|Sat|Sun) /i });
      await expect(confirmBtn).toBeEnabled({ timeout: 15_000 });
      await confirmBtn.click();

      await expect(page).toHaveURL(
        new RegExp(
          `/dashboard/appointments/${appointmentId}\\?confirmed=1(?:$|[&#])`,
        ),
        { timeout: 15_000 },
      );
      await expect(
        page.getByText(/The visit is in your agenda and the patient has been emailed/i),
      ).toBeVisible({ timeout: 12_000 });
    } finally {
      if (appointmentId) {
        await admin.from("appointments").delete().eq("id", appointmentId);
      }
    }
  });
});
