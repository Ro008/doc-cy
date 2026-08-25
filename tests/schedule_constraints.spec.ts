import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { format, addDays } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import { skipIfSafeNoBooking } from "./helpers/safeMode";

/** Integration / CI: override via repo variable INTEGRATION_SCHEDULE_TEST_DOCTOR_SLUG. */
const SCHEDULE_TEST_SLUG =
  process.env.INTEGRATION_SCHEDULE_TEST_DOCTOR_SLUG?.trim() || "andreas-nikos";

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

type DayHours = { enabled: boolean; start_time: string; end_time: string };

type WeeklySchedulePayload = {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
};

/**
 * Booking availability is resolved from doctor_locations (primary), not doctor_settings alone.
 * Updating the primary location also syncs schedule columns back to doctor_settings via trigger.
 */
async function syncPrimaryLocationSchedule(
  supabase: SupabaseClient,
  doctorId: string,
  input: {
    weekly_schedule: WeeklySchedulePayload;
    start_time: string;
    end_time: string;
    slot_duration_minutes?: number;
    break_start?: string | null;
    break_end?: string | null;
  },
): Promise<{ locationId: string | null; error: string | null }> {
  const schedule = input.weekly_schedule;
  const { data: primary, error: primaryErr } = await supabase
    .from("doctor_locations")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("is_primary", true)
    .maybeSingle();

  if (primaryErr || !primary?.id) {
    return {
      locationId: null,
      error: primaryErr?.message ?? "Primary doctor_locations row missing.",
    };
  }

  const { error: updateErr } = await supabase
    .from("doctor_locations")
    .update({
      monday: schedule.monday.enabled,
      tuesday: schedule.tuesday.enabled,
      wednesday: schedule.wednesday.enabled,
      thursday: schedule.thursday.enabled,
      friday: schedule.friday.enabled,
      saturday: schedule.saturday.enabled,
      sunday: schedule.sunday.enabled,
      start_time: input.start_time,
      end_time: input.end_time,
      weekly_schedule: schedule,
      break_start: input.break_start ?? null,
      break_end: input.break_end ?? null,
      slot_duration_minutes: input.slot_duration_minutes ?? 30,
      updated_at: new Date().toISOString(),
    })
    .eq("id", primary.id);

  return {
    locationId: primary.id as string,
    error: updateErr?.message ?? null,
  };
}

test.describe("Schedule constraints @booking-creates", { tag: "@pr-e2e" }, () => {
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
      .eq("slug", SCHEDULE_TEST_SLUG)
      .single();
    test.skip(
      !doctor?.id || !doctor?.slug,
      `Doctor slug "${SCHEDULE_TEST_SLUG}" not found.`,
    );

    const commonDay = { enabled: true, start_time: "09:00:00", end_time: "17:00:00" };
    const weekly_schedule: WeeklySchedulePayload = {
      monday: commonDay,
      tuesday: commonDay,
      wednesday: commonDay,
      thursday: commonDay,
      friday: { enabled: true, start_time: "09:00:00", end_time: "15:00:00" },
      saturday: { enabled: false, start_time: "09:00:00", end_time: "17:00:00" },
      sunday: { enabled: false, start_time: "09:00:00", end_time: "17:00:00" },
    };

    const synced = await syncPrimaryLocationSchedule(supabase, doctor.id, {
      weekly_schedule,
      start_time: "09:00:00",
      end_time: "17:00:00",
      slot_duration_minutes: 30,
      break_start: null,
      break_end: null,
    });
    test.skip(Boolean(synced.error), synced.error ?? "Could not sync primary location schedule.");

    const { error: upsertErr } = await supabase.from("doctor_settings").upsert(
      {
        doctor_id: doctor.id,
        holiday_mode_enabled: false,
        holiday_start_date: null,
        holiday_end_date: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "doctor_id" },
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
        isNewPatient: true,
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
        isNewPatient: true,
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
      .eq("slug", SCHEDULE_TEST_SLUG)
      .single();
    test.skip(!doctor?.id || doctor.status !== "verified", "Verified doctor not found.");

    const start = cyprusDateKey(1);
    const end = cyprusDateKey(3);
    const commonDay = { enabled: true, start_time: "09:00:00", end_time: "17:00:00" };
    const weekly_schedule: WeeklySchedulePayload = {
      monday: commonDay,
      tuesday: commonDay,
      wednesday: commonDay,
      thursday: commonDay,
      friday: commonDay,
      saturday: commonDay,
      sunday: commonDay,
    };

    const synced = await syncPrimaryLocationSchedule(supabase, doctor.id, {
      weekly_schedule,
      start_time: "09:00:00",
      end_time: "17:00:00",
      slot_duration_minutes: 30,
      break_start: null,
      break_end: null,
    });
    test.skip(Boolean(synced.error), synced.error ?? "Could not sync primary location schedule.");

    const { error: upsertErr } = await supabase.from("doctor_settings").upsert(
      {
        doctor_id: doctor.id,
        holiday_mode_enabled: true,
        holiday_start_date: start,
        holiday_end_date: end,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "doctor_id" },
    );
    test.skip(Boolean(upsertErr), "Missing migrated doctor_settings columns.");

    const res = await request.post("/api/appointments", {
      data: {
        doctorId: doctor.id,
        patientName: "Holiday Block Test",
        patientEmail: "holiday.block@test.com",
        patientPhone: "99123456",
        appointmentLocal: `${start}T10:00`,
        isNewPatient: true,
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
      .eq("slug", SCHEDULE_TEST_SLUG)
      .single();
    test.skip(!doctor?.id || doctor.status !== "verified", "Verified doctor not found.");

    const commonDay = { enabled: true, start_time: "09:00:00", end_time: "18:00:00" };
    const weekly_schedule: WeeklySchedulePayload = {
      monday: commonDay,
      tuesday: commonDay,
      wednesday: commonDay,
      thursday: commonDay,
      friday: commonDay,
      saturday: { enabled: false, start_time: "09:00:00", end_time: "18:00:00" },
      sunday: { enabled: false, start_time: "09:00:00", end_time: "18:00:00" },
    };

    const synced = await syncPrimaryLocationSchedule(supabase, doctor.id, {
      weekly_schedule,
      start_time: "09:00:00",
      end_time: "18:00:00",
      slot_duration_minutes: 30,
      break_start: null,
      break_end: null,
    });
    test.skip(Boolean(synced.error), synced.error ?? "Could not sync primary location schedule.");
    const primaryLocationId = synced.locationId;

    const { error: upsertErr } = await supabase.from("doctor_settings").upsert(
      {
        doctor_id: doctor.id,
        holiday_mode_enabled: false,
        holiday_start_date: null,
        holiday_end_date: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "doctor_id" },
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
        isNewPatient: true,
        reason: "Schedule constraint test — visit reason.",
      },
    });
    expect(misalignedRes.status()).toBe(400);
    const misalignedJson = await misalignedRes.json();
    expect(String(misalignedJson?.message ?? "")).toContain(
      "not aligned with the professional's slot duration",
    );

    // 2) Defensive overlap guard: even if an invalid 16:45 row exists (manual/admin insert),
    // API must block a 17:00 booking because ranges intersect.
    // Seed must use the same location_id the public booking API will resolve.
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
        location_id: primaryLocationId,
      })
      .select("id")
      .single();

    test.skip(Boolean(seeded.error), "Could not seed defensive-overlap fixture.");
    const seededId = seeded.data?.id as string | undefined;

    try {
      let overlapRes = await request.post("/api/appointments", {
        data: {
          doctorId: doctor.id,
          patientName: "Should conflict at 17:00",
          patientEmail: "overlap.1700@test.com",
          patientPhone: "99123456",
          appointmentLocal: `${targetDate}T17:00`,
          isNewPatient: true,
          reason: "Schedule constraint test — visit reason.",
        },
      });

      // CI can occasionally return a transient DB transaction-aborted 500 (25P02)
      // before stabilizing; retry a couple of times before asserting.
      for (let attempt = 0; attempt < 2 && overlapRes.status() === 500; attempt++) {
        const overlapErr = await overlapRes.json().catch(() => null);
        const msg = String(overlapErr?.message ?? "").toLowerCase();
        if (!msg.includes("transaction is aborted")) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
        overlapRes = await request.post("/api/appointments", {
          data: {
            doctorId: doctor.id,
            patientName: "Should conflict at 17:00",
            patientEmail: "overlap.1700@test.com",
            patientPhone: "99123456",
            appointmentLocal: `${targetDate}T17:00`,
            isNewPatient: true,
            reason: "Schedule constraint test — visit reason.",
          },
        });
      }

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
