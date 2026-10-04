import { test, expect } from "@playwright/test";
import {
  deleteTestClinics,
  openPrimaryClinicForBookings,
  seedProfessionalSpecialty,
} from "./helpers/test-doctor";
import { createClient } from "@supabase/supabase-js";
import { takeOverLatestDraftLink, withBookingDefaults } from "./helpers/online-booking";

function nextWeekdayDateKey(daysAhead = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// CI: exercises parallel POST /api/booking/confirm (two drafts, one time) against unique (professional_id, appointment_datetime).
test.describe("Integration: appointment race condition guard", { tag: ["@pr-e2e", "@pr-e2e-booking"] }, () => {
  test("same slot parallel booking creates one appointment only", async ({
    request,
  }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const safeEnv = process.env.INTEGRATION_SAFE_ENV === "1";

    // Hard safety guard: never allow this test to run on production targets.
    const unsafeBase = /mydoccy\.com/i.test(baseUrl);
    const normalizeUrl = (u: string) => u.replace(/\/+$/, "");
    const prodSupabase = normalizeUrl(
      process.env.PROD_NEXT_PUBLIC_SUPABASE_URL ?? "",
    );
    const integrationSupabase = normalizeUrl(supabaseUrl);
    const usingProductionSupabase =
      prodSupabase.length > 0 && integrationSupabase === prodSupabase;
    test.skip(
      !safeEnv || unsafeBase || usingProductionSupabase,
      "Unsafe target detected. Integration race test is restricted to isolated testing environment only.",
    );
    test.skip(
      !baseUrl || !supabaseUrl || !serviceRole,
      "Missing integration env vars.",
    );

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const doctorEmail = `race-doctor-${nonce}@integration.test`;
    const doctorSlug = `race-doctor-${nonce}`;

    let authUserId = "";
    let doctorId = "";
    let clinicId = "";
    const createdAppointmentIds: string[] = [];

    try {
      const createUserRes = await admin.auth.admin.createUser({
        email: doctorEmail,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (createUserRes.error || !createUserRes.data.user?.id) {
        throw new Error(
          `Failed creating integration auth user: ${createUserRes.error?.message}`,
        );
      }
      authUserId = createUserRes.data.user.id;

      const doctorInsert = await admin
        .from("professionals")
        .insert({
          auth_user_id: authUserId,
          name: `Race Doctor ${nonce}`,
          email: doctorEmail,
          languages: ["English"],
          slug: doctorSlug,
                is_registered: true,
      pro_access_until: new Date(Date.now() + 180 * 86_400_000).toISOString(),
      is_archived: false,
      subscription_tier: "standard",

        })
        .select("id")
        .single();
      if (doctorInsert.error || !doctorInsert.data?.id) {
        throw new Error(
          `Failed creating integration doctor: ${doctorInsert.error?.message}`,
        );
      }
      doctorId = doctorInsert.data.id as string;
      await seedProfessionalSpecialty(admin, doctorId, {
        specialty: "General Practice",
        licenseNumber: `LIC-RACE-${nonce}`,
      });

      const settingsUpsert = await admin.from("professional_settings").upsert(
        {
          professional_id: doctorId,
          holiday_mode_enabled: false,
          holiday_start_date: null,
          holiday_end_date: null,
          booking_horizon_days: 90,
          minimum_notice_hours: 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "professional_id" },
      );
      if (settingsUpsert.error) {
        throw new Error(
          `Failed preparing doctor settings: ${settingsUpsert.error.message}`,
        );
      }

      // An open primary clinic, as every approved registration has.
      clinicId = (await openPrimaryClinicForBookings(admin, doctorId, nonce)).clinicId;

      const targetDate = nextWeekdayDateKey(1);
      const targetLocal = `${targetDate}T10:00`;

      const payloadA = {
        doctorId,
        patientName: `Race Patient A ${nonce}`,
        patientEmail: `race-a-${nonce}@integration.test`,
        patientPhone: "99123456",
        appointmentLocal: targetLocal,
        isNewPatient: true,
        reason: "Integration race test — reason for visit.",
      };
      const payloadB = {
        doctorId,
        patientName: `Race Patient B ${nonce}`,
        patientEmail: `race-b-${nonce}@integration.test`,
        patientPhone: "99123456",
        appointmentLocal: targetLocal,
        isNewPatient: true,
        reason: "Integration race test — reason for visit.",
      };

      // Both submit (drafts hold no time), then both confirm their emailed link at once:
      // exactly one confirmation gets the slot.
      const [subA, subB] = await Promise.all([
        request.post("/api/appointments", { data: withBookingDefaults(payloadA) }),
        request.post("/api/appointments", { data: withBookingDefaults(payloadB) }),
      ]);
      expect([subA.status(), subB.status()]).toEqual([202, 202]);
      const tokenA = await takeOverLatestDraftLink(admin, payloadA.patientEmail);
      const tokenB = await takeOverLatestDraftLink(admin, payloadB.patientEmail);

      const [resA, resB] = await Promise.all([
        request.post("/api/booking/confirm", { data: { token: tokenA } }),
        request.post("/api/booking/confirm", { data: { token: tokenB } }),
      ]);

      const statuses = [resA.status(), resB.status()].sort((a, b) => a - b);
      expect(statuses).toEqual([200, 409]);

      const okResponse = resA.status() === 200 ? resA : resB;
      const okJson = await okResponse.json();
      const createdId = String(okJson?.appointment?.id ?? "");
      if (createdId) createdAppointmentIds.push(createdId);

      const slotCheck = await admin
        .from("appointments")
        .select("id,appointment_datetime")
        .eq("professional_id", doctorId);
      if (slotCheck.error) {
        throw new Error(
          `Failed reading created appointments: ${slotCheck.error.message}`,
        );
      }

      const tenAmRows = (slotCheck.data ?? []).filter((r) =>
        String(
          (r as { appointment_datetime?: string }).appointment_datetime ?? "",
        ).match(/T(07|10):00/),
      );
      expect(tenAmRows.length).toBe(1);
      for (const row of tenAmRows) {
        const id = String((row as { id?: string }).id ?? "");
        if (id) createdAppointmentIds.push(id);
      }
    } finally {
      if (createdAppointmentIds.length > 0) {
        await admin
          .from("appointments")
          .delete()
          .in("id", Array.from(new Set(createdAppointmentIds)));
      }
      if (doctorId) {
        await admin.from("professional_settings").delete().eq("professional_id", doctorId);
        await admin.from("professionals").delete().eq("id", doctorId);
        await deleteTestClinics(admin, [clinicId]);
      }
      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });
});
