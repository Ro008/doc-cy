import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { zonedTimeToUtc, utcToZonedTime } from "date-fns-tz";

import { CY_TZ } from "@/lib/appointments";
import { signInDoctorAndSetCookies } from "../helpers/doctorAuth";

const SCHEDULE_TEST_SLUG =
  process.env.INTEGRATION_SCHEDULE_TEST_DOCTOR_SLUG?.trim() || "andreas-nikos";

test.describe("Agenda multi-session sync", () => {
  test("mobile session reflects confirm + delete without manual refresh", async ({
    browser,
  }, testInfo) => {
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Run only on Desktop Chromium for CI stability.",
    );

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    test.skip(
      !supabaseUrl || !anon || !serviceRole,
      "Missing Supabase integration env vars.",
    );

    const admin = createClient(supabaseUrl, serviceRole);
    const anonClient = createClient(supabaseUrl, anon);

    const laptopCtx = await browser.newContext();
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const laptop = await laptopCtx.newPage();
    const mobile = await mobileCtx.newPage();

    const nowCy = utcToZonedTime(new Date(), CY_TZ);
    const todayKey = format(nowCy, "yyyy-MM-dd");
    const iso = zonedTimeToUtc(`${todayKey}T19:30`, CY_TZ).toISOString();
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const patientName = `SyncAuto ${nonce.slice(-5)}`;

    let appointmentId = "";
    try {
      const { authUserId } = await signInDoctorAndSetCookies(laptop, anonClient);
      await signInDoctorAndSetCookies(mobile, anonClient);

      const { data: doctor, error: docErr } = await admin
        .from("doctors")
        .select("id,slug")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      test.skip(Boolean(docErr) || !doctor?.id, "Doctor not found for auth user.");
      test.skip(
        String(doctor.slug ?? "") !== SCHEDULE_TEST_SLUG,
        `Test user slug mismatch (expected ${SCHEDULE_TEST_SLUG}).`,
      );

      const inserted = await admin
        .from("appointments")
        .insert({
          doctor_id: doctor.id,
          patient_name: patientName,
          patient_email: `sync-${nonce}@integration.test`,
          patient_phone: "99123456",
          appointment_datetime: iso,
          status: "REQUESTED",
          reason: "Multi-session sync test reason",
        })
        .select("id")
        .single();
      expect(inserted.error).toBeNull();
      appointmentId = String(inserted.data?.id ?? "");
      expect(appointmentId).not.toBe("");

      await laptop.goto("/agenda");
      await mobile.goto("/agenda");

      const mobileCard = mobile.locator("button", { hasText: patientName }).first();
      await expect(mobileCard).toBeVisible({ timeout: 20000 });
      await mobileCard.click();
      await expect(mobile.getByText("Review & confirm request")).toBeVisible();
      await mobile.getByRole("button", { name: "Close" }).click();

      const confirmRes = await admin
        .from("appointments")
        .update({ status: "CONFIRMED" })
        .eq("id", appointmentId)
        .eq("doctor_id", doctor.id);
      expect(confirmRes.error).toBeNull();

      await expect
        .poll(
          async () => {
            await mobileCard.click();
            const hasWhatsapp = await mobile
              .getByRole("link", { name: /chat on whatsapp/i })
              .count();
            await mobile.getByRole("button", { name: "Close" }).click();
            return hasWhatsapp;
          },
          { timeout: 20000, intervals: [1000, 2000, 3000] },
        )
        .toBe(1);

      const deleteRes = await admin
        .from("appointments")
        .delete()
        .eq("id", appointmentId)
        .eq("doctor_id", doctor.id);
      expect(deleteRes.error).toBeNull();
      appointmentId = "";

      await expect(mobileCard).toHaveCount(0, { timeout: 20000 });
    } finally {
      if (appointmentId) {
        await admin.from("appointments").delete().eq("id", appointmentId);
      }
      await laptopCtx.close();
      await mobileCtx.close();
    }
  });
});
