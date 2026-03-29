import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { format, addDays } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import { skipIfSafeNoBooking } from "./helpers/safeMode";

function cyprusDateKey(daysAhead = 0): string {
  const nowCy = utcToZonedTime(new Date(), CY_TZ);
  return format(addDays(nowCy, daysAhead), "yyyy-MM-dd");
}

function nextWeekdayCyprusKey(minDaysAhead = 1): string {
  const nowCy = utcToZonedTime(new Date(), CY_TZ);
  let d = addDays(nowCy, minDaysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d = addDays(d, 1);
  }
  return format(d, "yyyy-MM-dd");
}

test.describe("Schedule constraints @booking-creates", () => {
  test("friday end time 15:00 allows 14:30 but blocks 15:00", async ({
    request,
  }) => {
    skipIfSafeNoBooking(test.info());

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    test.skip(!supabaseUrl || !serviceRole, "Missing Supabase env vars.");

    const supabase = createClient(supabaseUrl, serviceRole);
    const { data: doctor } = await supabase
      .from("doctors")
      .select("id,slug")
      .eq("slug", "andreas-nikos")
      .single();
    test.skip(!doctor?.id || !doctor?.slug, "Doctor andreas-nikos not found.");

    const commonDay = { enabled: true, start_time: "09:00:00", end_time: "17:00:00" };
    const { error: upsertErr } = await supabase.from("doctor_settings").upsert(
      {
        doctor_id: doctor.id,
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
          monday: commonDay,
          tuesday: commonDay,
          wednesday: commonDay,
          thursday: commonDay,
          friday: { enabled: true, start_time: "09:00:00", end_time: "15:00:00" },
          saturday: { enabled: false, start_time: "09:00:00", end_time: "17:00:00" },
          sunday: { enabled: false, start_time: "09:00:00", end_time: "17:00:00" },
        },
        holiday_mode_enabled: false,
        holiday_start_date: null,
        holiday_end_date: null,
        break_start: null,
        break_end: null,
        slot_duration_minutes: 30,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "doctor_id" }
    );
    test.skip(Boolean(upsertErr), "Missing migrated doctor_settings columns.");

    const nowCy = utcToZonedTime(new Date(), CY_TZ);
    const daysUntilFriday = (5 - nowCy.getDay() + 7) % 7 || 7;
    const fridayKey = format(addDays(nowCy, daysUntilFriday), "yyyy-MM-dd");

    const resAllowed = await request.post("/api/appointments", {
      data: {
        doctorId: doctor.id,
        patientName: "Friday Allowed Test",
        patientEmail: "friday.allowed@test.com",
        patientPhone: "99123456",
        appointmentLocal: `${fridayKey}T14:30`,
        reason: "Schedule constraint test — visit reason.",
      },
    });
    expect([200, 201, 409]).toContain(resAllowed.status());

    const resBlocked = await request.post("/api/appointments", {
      data: {
        doctorId: doctor.id,
        patientName: "Friday Blocked Test",
        patientEmail: "friday.blocked@test.com",
        patientPhone: "99123456",
        appointmentLocal: `${fridayKey}T15:00`,
        reason: "Schedule constraint test — visit reason.",
      },
    });
    expect(resBlocked.status()).toBe(400);
    const blockedJson = await resBlocked.json();
    expect(blockedJson?.message).toContain("outside the professional's availability");
  });

  test("holiday mode blocks booking requests in range", async ({ request }) => {
    skipIfSafeNoBooking(test.info());

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    test.skip(!supabaseUrl || !serviceRole, "Missing Supabase env vars.");

    const supabase = createClient(supabaseUrl, serviceRole);
    const { data: doctor } = await supabase
      .from("doctors")
      .select("id,slug,status")
      .eq("slug", "andreas-nikos")
      .single();
    test.skip(!doctor?.id || doctor.status !== "verified", "Verified doctor not found.");

    const start = cyprusDateKey(1);
    const end = cyprusDateKey(3);
    const commonDay = { enabled: true, start_time: "09:00:00", end_time: "17:00:00" };
    const { error: upsertErr } = await supabase.from("doctor_settings").upsert(
      {
        doctor_id: doctor.id,
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
        start_time: "09:00:00",
        end_time: "17:00:00",
        weekly_schedule: {
          monday: commonDay,
          tuesday: commonDay,
          wednesday: commonDay,
          thursday: commonDay,
          friday: commonDay,
          saturday: commonDay,
          sunday: commonDay,
        },
        holiday_mode_enabled: true,
        holiday_start_date: start,
        holiday_end_date: end,
        break_start: null,
        break_end: null,
        slot_duration_minutes: 30,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "doctor_id" }
    );
    test.skip(Boolean(upsertErr), "Missing migrated doctor_settings columns.");

    const res = await request.post("/api/appointments", {
      data: {
        doctorId: doctor.id,
        patientName: "Holiday Block Test",
        patientEmail: "holiday.block@test.com",
        patientPhone: "99123456",
        appointmentLocal: `${start}T10:00`,
        reason: "Schedule constraint test — visit reason.",
      },
    });

    expect(res.status()).toBe(403);
    const json = await res.json();
    expect(json?.message).toContain("Bookings temporarily unavailable");
  });

  test("slot alignment and overlap guard block 16:45 -> 17:00 conflict", async ({
    request,
  }) => {
    skipIfSafeNoBooking(test.info());

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    test.skip(!supabaseUrl || !serviceRole, "Missing Supabase env vars.");

    const supabase = createClient(supabaseUrl, serviceRole);
    const { data: doctor } = await supabase
      .from("doctors")
      .select("id,slug,status")
      .eq("slug", "andreas-nikos")
      .single();
    test.skip(!doctor?.id || doctor.status !== "verified", "Verified doctor not found.");

    const commonDay = { enabled: true, start_time: "09:00:00", end_time: "18:00:00" };
    const { error: upsertErr } = await supabase.from("doctor_settings").upsert(
      {
        doctor_id: doctor.id,
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
        start_time: "09:00:00",
        end_time: "18:00:00",
        weekly_schedule: {
          monday: commonDay,
          tuesday: commonDay,
          wednesday: commonDay,
          thursday: commonDay,
          friday: commonDay,
          saturday: { enabled: false, start_time: "09:00:00", end_time: "18:00:00" },
          sunday: { enabled: false, start_time: "09:00:00", end_time: "18:00:00" },
        },
        holiday_mode_enabled: false,
        holiday_start_date: null,
        holiday_end_date: null,
        break_start: null,
        break_end: null,
        slot_duration_minutes: 30,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "doctor_id" }
    );
    test.skip(Boolean(upsertErr), "Missing migrated doctor_settings columns.");

    const targetDate = nextWeekdayCyprusKey(1);

    // 1) API must reject misaligned times for 30-minute slots.
    const misalignedRes = await request.post("/api/appointments", {
      data: {
        doctorId: doctor.id,
        patientName: "Misaligned 16:45",
        patientEmail: "misaligned.1645@test.com",
        patientPhone: "99123456",
        appointmentLocal: `${targetDate}T16:45`,
        reason: "Schedule constraint test — visit reason.",
      },
    });
    expect(misalignedRes.status()).toBe(400);
    const misalignedJson = await misalignedRes.json();
    expect(String(misalignedJson?.message ?? "")).toContain(
      "not aligned with the professional's slot duration"
    );

    // 2) Defensive overlap guard: even if an invalid 16:45 row exists (manual/admin insert),
    // API must block a 17:00 booking because ranges intersect.
    const invalidStartUtc = zonedTimeToUtc(`${targetDate}T16:45`, CY_TZ as string);
    const seeded = await supabase
      .from("appointments")
      .insert({
        doctor_id: doctor.id,
        patient_name: "Seeded Invalid 16:45",
        patient_email: "seeded.invalid.1645@test.com",
        patient_phone: "99123456",
        appointment_datetime: invalidStartUtc.toISOString(),
        status: "CONFIRMED",
        reason: "Seeded overlap fixture",
        visit_type: null,
        visit_notes: null,
      })
      .select("id")
      .single();

    test.skip(Boolean(seeded.error), "Could not seed defensive-overlap fixture.");
    const seededId = seeded.data?.id as string | undefined;

    try {
      const overlapRes = await request.post("/api/appointments", {
        data: {
          doctorId: doctor.id,
          patientName: "Should conflict at 17:00",
          patientEmail: "overlap.1700@test.com",
          patientPhone: "99123456",
          appointmentLocal: `${targetDate}T17:00`,
          reason: "Schedule constraint test — visit reason.",
        },
      });
      expect(overlapRes.status()).toBe(409);
      const overlapJson = await overlapRes.json();
      expect(String(overlapJson?.message ?? "")).toContain("Slot already taken");
    } finally {
      if (seededId) {
        await supabase.from("appointments").delete().eq("id", seededId);
      }
    }
  });
});

