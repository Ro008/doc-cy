import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function nextWeekdayDateKey(daysAhead = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// CI: exercises parallel POST /api/appointments against unique (doctor_id, appointment_datetime).
test.describe("Integration: appointment race condition guard", () => {
  test("same slot parallel booking creates one appointment only", async ({
    request,
  }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const safeEnv = process.env.INTEGRATION_SAFE_ENV === "1";

    // Hard safety guard: never allow this test to run on production targets.
    const unsafeBase = /mydoccy\.com|vercel\.app/i.test(baseUrl);
    const unsafeSupabase = /supabase\.co/i.test(supabaseUrl);
    test.skip(
      !safeEnv || unsafeBase || unsafeSupabase,
      "Unsafe target detected. Integration race test is restricted to isolated testing environment only."
    );
    test.skip(!baseUrl || !supabaseUrl || !serviceRole, "Missing integration env vars.");

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const doctorEmail = `race-doctor-${nonce}@integration.test`;
    const doctorSlug = `race-doctor-${nonce}`;

    let authUserId = "";
    let doctorId = "";
    const createdAppointmentIds: string[] = [];

    try {
      const createUserRes = await admin.auth.admin.createUser({
        email: doctorEmail,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (createUserRes.error || !createUserRes.data.user?.id) {
        throw new Error(`Failed creating integration auth user: ${createUserRes.error?.message}`);
      }
      authUserId = createUserRes.data.user.id;

      const doctorInsert = await admin
        .from("doctors")
        .insert({
          auth_user_id: authUserId,
          name: `Race Doctor ${nonce}`,
          specialty: "General Practice",
          email: doctorEmail,
          phone: "+35799123456",
          languages: ["English"],
          license_number: `LIC-RACE-${nonce}`,
          license_file_url: `licenses/integration/${nonce}.pdf`,
          status: "verified",
          slug: doctorSlug,
          is_specialty_approved: true,
          subscription_tier: "standard",
        })
        .select("id")
        .single();
      if (doctorInsert.error || !doctorInsert.data?.id) {
        throw new Error(`Failed creating integration doctor: ${doctorInsert.error?.message}`);
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
        { onConflict: "doctor_id" }
      );
      if (settingsUpsert.error) {
        throw new Error(`Failed preparing doctor settings: ${settingsUpsert.error.message}`);
      }

      const targetDate = nextWeekdayDateKey(1);
      const targetLocal = `${targetDate}T10:00`;

      const payloadA = {
        doctorId,
        patientName: `Race Patient A ${nonce}`,
        patientEmail: `race-a-${nonce}@integration.test`,
        patientPhone: "99123456",
        appointmentLocal: targetLocal,
        visitType: "First Consultation",
      };
      const payloadB = {
        doctorId,
        patientName: `Race Patient B ${nonce}`,
        patientEmail: `race-b-${nonce}@integration.test`,
        patientPhone: "99123456",
        appointmentLocal: targetLocal,
        visitType: "First Consultation",
      };

      const [resA, resB] = await Promise.all([
        request.post("/api/appointments", { data: payloadA }),
        request.post("/api/appointments", { data: payloadB }),
      ]);

      const statuses = [resA.status(), resB.status()].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);

      const okResponse = resA.status() === 201 ? resA : resB;
      const okJson = await okResponse.json();
      const createdId = String(okJson?.appointment?.id ?? "");
      if (createdId) createdAppointmentIds.push(createdId);

      const slotCheck = await admin
        .from("appointments")
        .select("id,appointment_datetime")
        .eq("doctor_id", doctorId);
      if (slotCheck.error) {
        throw new Error(`Failed reading created appointments: ${slotCheck.error.message}`);
      }

      const tenAmRows = (slotCheck.data ?? []).filter((r) =>
        String((r as { appointment_datetime?: string }).appointment_datetime ?? "").includes("T10:00")
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
        await admin.from("doctor_settings").delete().eq("doctor_id", doctorId);
        await admin.from("doctors").delete().eq("id", doctorId);
      }
      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });
});

