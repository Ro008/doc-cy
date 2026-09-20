import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { zonedTimeToUtc, utcToZonedTime } from "date-fns-tz";

import { CY_TZ } from "@/lib/appointments";
import { exposeSupabaseAuthCookiesToClient } from "../helpers/doctorAuth";
import {
  createTestDoctor,
  deleteTestDoctor,
  loginDoctorUi,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

/**
 * Guards a promise we make to professionals: a second open session reflects a
 * confirmation without a manual refresh.
 *
 * This was quarantined as `test.fixme` because the appointment vanished from the
 * mobile session. Measured cause: nothing to do with confirming, and nothing to
 * do with the multi-clinic filter. `signInDoctorAndSetCookies` injects the
 * Supabase session cookie as **httpOnly**, which the server can read but
 * `document.cookie` cannot. So SSR rendered the agenda while the browser-side
 * client in AgendaRealtime had no session at all: its PostgREST read ran as
 * `anon`, RLS returned `200 []`, and the 10s refresh replaced the whole list
 * with nothing about five seconds after load. The confirmation merely happened
 * to come after that, which is why it looked like the trigger.
 *
 * The fix is `exposeSupabaseAuthCookiesToClient`, which already existed for the
 * public-page specs: it rewrites those cookies as non-httpOnly. Any spec that
 * asserts on data fetched by a client component needs it.
 *
 * This spec also now builds its own doctor instead of leaning on the shared
 * account and the `andreas-nikos` fixture, so it no longer skips itself when
 * that slug or credential drifts.
 */
test.describe("Agenda multi-session sync", { tag: "@pr-email" }, () => {
  test("second session reflects confirm + delete without manual refresh", async ({
    browser,
  }, testInfo) => {
    // Two contexts, two sign-ins, two agenda loads and polled realtime
    // assertions do not fit in the 30s default.
    test.setTimeout(150_000);
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Run only on Desktop Chromium for CI stability.",
    );

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    test.skip(!supabaseUrl || !serviceRole, "Missing Supabase integration env vars.");

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `sync${Date.now()}`.slice(-12);

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
    const patientName = `SyncAuto ${nonce.slice(-5)}`;

    let fixture: TestDoctorFixture | null = null;
    let appointmentId = "";
    try {
      fixture = await createTestDoctor({
        admin,
        nonce,
        name: `Sync Doctor ${nonce.slice(-4)}`,
        specialty: "Cardiology",
        is_specialty_approved: true,
        status: "verified",
      });

      const inserted = await admin
        .from("appointments")
        .insert({
          doctor_id: fixture.doctorId,
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

      for (const page of [laptop, mobile]) {
        await loginDoctorUi(page, fixture.email, fixture.password);
        // Without this the browser-side Supabase client has no session and the
        // agenda's own refresh silently empties itself. See the note above.
        await exposeSupabaseAuthCookiesToClient(page);
        await page.goto("/agenda");
      }

      const mobileCard = mobile.locator("button", { hasText: patientName }).first();
      await expect(mobileCard).toBeVisible({ timeout: 20_000 });
      await mobileCard.click();
      await expect(mobile.getByText("Review & confirm request")).toBeVisible({
        timeout: 20_000,
      });
      await mobile.getByRole("button", { name: "Close", exact: true }).first().click();

      const confirmRes = await admin
        .from("appointments")
        .update({ status: "CONFIRMED" })
        .eq("id", appointmentId)
        .eq("doctor_id", fixture.doctorId);
      expect(confirmRes.error).toBeNull();

      // The confirmation must reach this session on its own (realtime, or the
      // 10s polling fallback) — no reload.
      await expect
        .poll(
          async () => {
            await mobileCard.click();
            const hasReschedule = await mobile
              .getByRole("button", { name: /Reschedule appointment/i })
              .count();
            await mobile
              .getByRole("button", { name: "Close", exact: true })
              .first()
              .click();
            return hasReschedule;
          },
          { timeout: 30_000, intervals: [1000, 2000, 3000] },
        )
        .toBe(1);

      const deleteRes = await admin
        .from("appointments")
        .delete()
        .eq("id", appointmentId)
        .eq("doctor_id", fixture.doctorId);
      expect(deleteRes.error).toBeNull();
      appointmentId = "";

      await expect(mobileCard).toHaveCount(0, { timeout: 30_000 });
    } finally {
      if (fixture) {
        await admin.from("appointments").delete().eq("doctor_id", fixture.doctorId);
        await deleteTestDoctor(fixture);
      }
      await laptopCtx.close();
      await mobileCtx.close();
    }
  });
});
