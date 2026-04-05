import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { zonedTimeToUtc } from "date-fns-tz";

import { CY_TZ } from "@/lib/appointments";

function nextWeekdayDateKey(daysAhead = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Regression: NEEDS_RESCHEDULE must not block the original appointment_datetime for new
 * public bookings (overlap + partial unique index). See appointments_unique_slot_active_only.sql.
 */
test.describe("Integration: NEEDS_RESCHEDULE frees original slot", () => {
  test("another patient can book the original time while counter-proposal is pending", async ({
    request,
  }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const safeEnv = process.env.INTEGRATION_SAFE_ENV === "1";

    const normalizeUrl = (u: string) => u.replace(/\/+$/, "");
    const prodSupabase = normalizeUrl(
      process.env.PROD_NEXT_PUBLIC_SUPABASE_URL ?? "",
    );
    const integrationSupabase = normalizeUrl(supabaseUrl);
    const usingProductionSupabase =
      prodSupabase.length > 0 && integrationSupabase === prodSupabase;
    const unsafeBase = /mydoccy\.com/i.test(baseUrl);

    test.skip(
      !safeEnv || unsafeBase || usingProductionSupabase,
      "Unsafe target or missing INTEGRATION_SAFE_ENV.",
    );
    test.skip(!baseUrl || !supabaseUrl || !serviceRole, "Missing integration env vars.");

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const doctorEmail = `needs-rs-doctor-${nonce}@integration.test`;
    const doctorSlug = `needs-rs-doctor-${nonce}`;

    let authUserId = "";
    let doctorId = "";
    let fixtureAppointmentId = "";

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
        .from("doctors")
        .insert({
          auth_user_id: authUserId,
          name: `NeedsRs Doctor ${nonce}`,
          specialty: "General Practice",
          email: doctorEmail,
          phone: "+35799123456",
          languages: ["English"],
          license_number: `LIC-NR-${nonce}`,
          license_file_url: `licenses/integration/${nonce}-nr.pdf`,
          status: "verified",
          slug: doctorSlug,
          is_specialty_approved: true,
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

      const day = {
        enabled: true,
        start_time: "09:00:00",
        end_time: "17:00:00",
      };
      const settingsUpsert = await admin.from("doctor_settings").upsert(
        {
          doctor_id: doctorId,
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
        { onConflict: "doctor_id" },
      );
      if (settingsUpsert.error) {
        throw new Error(
          `Failed preparing doctor settings: ${settingsUpsert.error.message}`,
        );
      }

      const targetDate = nextWeekdayDateKey(1);
      const originalLocal = `${targetDate}T11:00`;
      const proposedLocal = `${targetDate}T14:00`;
      const originalIso = zonedTimeToUtc(originalLocal, CY_TZ).toISOString();
      const proposedIso = zonedTimeToUtc(proposedLocal, CY_TZ).toISOString();

      const counterAppt = await admin
        .from("appointments")
        .insert({
          doctor_id: doctorId,
          patient_name: `Counteroffer ${nonce}`,
          patient_email: `counter-${nonce}@integration.test`,
          patient_phone: "99123456",
          appointment_datetime: originalIso,
          status: "NEEDS_RESCHEDULE",
          duration_minutes: 30,
          reason: "Integration NEEDS_RESCHEDULE fixture",
          visit_type: null,
          visit_notes: null,
          proposed_slots: [proposedIso],
          proposal_expires_at: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
        })
        .select("id")
        .single();

      if (counterAppt.error || !counterAppt.data?.id) {
        throw new Error(
          `Failed inserting NEEDS_RESCHEDULE fixture: ${counterAppt.error?.message}`,
        );
      }
      fixtureAppointmentId = String(counterAppt.data.id);

      const bookOriginalRes = await request.post("/api/appointments", {
        data: {
          doctorId,
          patientName: `New patient ${nonce}`,
          patientEmail: `new-${nonce}@integration.test`,
          patientPhone: "99123456",
          appointmentLocal: originalLocal,
          reason: "Integration — book slot freed by NEEDS_RESCHEDULE semantics.",
        },
      });

      expect(bookOriginalRes.status()).toBe(201);
      const json = await bookOriginalRes.json();
      const newId = String(json?.appointment?.id ?? "");
      expect(newId).not.toBe("");
      expect(newId).not.toBe(fixtureAppointmentId);

      await admin.from("appointments").delete().eq("id", newId);
    } finally {
      if (fixtureAppointmentId) {
        await admin.from("appointments").delete().eq("id", fixtureAppointmentId);
      }
      if (doctorId) {
        await admin.from("doctor_settings").delete().eq("doctor_id", doctorId);
        await admin.from("doctors").delete().eq("id", doctorId);
      }
      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });
});
