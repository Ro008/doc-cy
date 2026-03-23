import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { format, addDays } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import { skipIfSafeNoBooking } from "./helpers/safeMode";

function cyprusDateKey(daysAhead = 0): string {
  const nowCy = utcToZonedTime(new Date(), CY_TZ);
  return format(addDays(nowCy, daysAhead), "yyyy-MM-dd");
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
        visitType: "First Consultation",
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
        visitType: "First Consultation",
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
        visitType: "First Consultation",
      },
    });

    expect(res.status()).toBe(403);
    const json = await res.json();
    expect(json?.message).toContain("Bookings temporarily unavailable");
  });
});

