import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DoctorLocationRow } from "../../lib/doctor-locations";
import { checkOnlineBookingSlot } from "../../lib/online-booking-slot-check";

/**
 * The checks an online booking passes, both when the patient submits the form and again
 * when they confirm the emailed link (the time may have been taken in between). Moved
 * out of POST /api/appointments so the two can't drift.
 */
const NOW = new Date("2026-10-05T08:00:00Z"); // Monday 11:00 in Cyprus
const PRO = "pro-1";

function location(partial: Partial<DoctorLocationRow> = {}): DoctorLocationRow {
  return {
    id: "link-1",
    doctor_id: PRO,
    clinic_id: "clinic-1",
    clinic_name: "Evangelismos",
    is_primary: true,
    sort_order: 0,
    label: null,
    district: "Nicosia",
    clinic_address: "Makariou 10, Nicosia",
    town: "Nicosia",
    latitude: null,
    longitude: null,
    clinic_place_id: null,
    pause_online_bookings: false,
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    start_time: "09:00:00",
    end_time: "17:00:00",
    weekly_schedule: null,
    break_start: null,
    break_end: null,
    slot_duration_minutes: 30,
    ...partial,
  };
}

type Fixture = {
  professional?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  appointments?: Record<string, unknown>[];
};

function fakeSupabase(fx: Fixture = {}) {
  const professional =
    fx.professional === undefined
      ? { id: PRO, is_registered: true, pro_access_until: "2027-01-01T00:00:00Z" }
      : fx.professional;
  const settings =
    fx.settings === undefined
      ? {
          professional_id: PRO,
          holiday_mode_enabled: false,
          holiday_start_date: null,
          holiday_end_date: null,
          booking_horizon_days: 90,
          minimum_notice_hours: 2,
        }
      : fx.settings;
  const tables: Record<string, unknown> = {
    professionals: professional,
    professional_settings: settings,
    appointments: fx.appointments ?? [],
  };
  return {
    from(table: string) {
      const value = tables[table];
      const builder: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in"]) builder[m] = () => builder;
      builder.single = async () =>
        value ? { data: value, error: null } : { data: null, error: { code: "PGRST116", message: "none" } };
      builder.maybeSingle = async () => ({ data: value ?? null, error: null });
      builder.then = (resolve: (v: unknown) => void) => resolve({ data: value, error: null });
      return builder;
    },
  };
}

async function check(
  appointmentLocal: string,
  fx: Fixture = {},
  locations: DoctorLocationRow[] = [location()],
  locationId: string | null = null,
) {
  return checkOnlineBookingSlot(
    fakeSupabase(fx) as never,
    { professionalId: PRO, appointmentLocal, locationId },
    { now: NOW, loadLocations: async () => locations },
  );
}

describe("checkOnlineBookingSlot", () => {
  it("accepts a free time inside the clinic's hours", async () => {
    const res = await check("2026-10-07T10:00");
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.appointmentUtc.toISOString(), "2026-10-07T07:00:00.000Z");
    assert.equal(res.bookingLocation.id, "link-1");
    assert.equal(res.bookingLocation.clinic_id, "clinic-1");
    assert.equal(res.slotDurationMinutes, 30);
  });

  it("refuses an unregistered profile", async () => {
    const res = await check("2026-10-07T10:00", {
      professional: { id: PRO, is_registered: false, pro_access_until: "2027-01-01T00:00:00Z" },
    });
    assert.deepEqual(res.ok ? null : [res.status, res.code], [403, "not_registered"]);
  });

  it("refuses when pro access has ended", async () => {
    const res = await check("2026-10-07T10:00", {
      professional: { id: PRO, is_registered: true, pro_access_until: "2026-10-01T00:00:00Z" },
    });
    assert.deepEqual(res.ok ? null : [res.status, res.code], [403, "access_expired"]);
  });

  it("refuses a paused clinic", async () => {
    const res = await check("2026-10-07T10:00", {}, [location({ pause_online_bookings: true })]);
    assert.deepEqual(res.ok ? null : [res.status, res.code], [403, "clinic_paused"]);
  });

  it("refuses when the professional has no bookable clinic", async () => {
    const res = await check("2026-10-07T10:00", {}, []);
    assert.deepEqual(res.ok ? null : res.status, 403);
  });

  it("books the clinic the patient picked when she has several", async () => {
    const two = [location(), location({ id: "link-2", clinic_id: "clinic-2", is_primary: false })];
    const res = await check("2026-10-07T10:00", {}, two, "link-2");
    assert.equal(res.ok && res.bookingLocation.id, "link-2");
  });

  it("finds the clinic link by clinic id (confirming a draft)", async () => {
    const two = [location(), location({ id: "link-2", clinic_id: "clinic-2", is_primary: false })];
    const res = await checkOnlineBookingSlot(
      fakeSupabase() as never,
      { professionalId: PRO, appointmentLocal: "2026-10-07T10:00", clinicId: "clinic-2" },
      { now: NOW, loadLocations: async () => two },
    );
    assert.equal(res.ok && res.bookingLocation.id, "link-2");
  });

  it("refuses when she no longer works at the draft's clinic", async () => {
    const res = await checkOnlineBookingSlot(
      fakeSupabase() as never,
      { professionalId: PRO, appointmentLocal: "2026-10-07T10:00", clinicId: "clinic-gone" },
      { now: NOW, loadLocations: async () => [location()] },
    );
    assert.deepEqual(res.ok ? null : [res.status, res.code], [403, "no_clinic"]);
  });

  it("refuses a time outside the clinic's hours", async () => {
    const res = await check("2026-10-07T18:00");
    assert.deepEqual(res.ok ? null : [res.status, res.code], [400, "outside_hours"]);
  });

  it("refuses a weekend day the clinic is closed", async () => {
    const res = await check("2026-10-10T10:00");
    assert.deepEqual(res.ok ? null : [res.status, res.code], [400, "outside_hours"]);
  });

  it("refuses a time off the slot grid", async () => {
    const res = await check("2026-10-07T10:10");
    assert.deepEqual(res.ok ? null : [res.status, res.code], [400, "not_aligned"]);
  });

  it("refuses a time inside the minimum notice", async () => {
    const res = await check("2026-10-05T12:00");
    assert.deepEqual(res.ok ? null : [res.status, res.code], [400, "minimum_notice"]);
  });

  it("refuses a time beyond the booking horizon", async () => {
    const res = await check("2027-02-01T10:00");
    assert.deepEqual(res.ok ? null : [res.status, res.code], [400, "beyond_horizon"]);
  });

  it("refuses a day inside her holiday", async () => {
    const res = await check("2026-10-07T10:00", {
      settings: {
        professional_id: PRO,
        holiday_mode_enabled: true,
        holiday_start_date: "2026-10-06",
        holiday_end_date: "2026-10-08",
        booking_horizon_days: 90,
        minimum_notice_hours: 2,
      },
    });
    assert.deepEqual(res.ok ? null : [res.status, res.code], [403, "holiday"]);
  });

  it("refuses a time another visit already covers (any clinic)", async () => {
    const res = await check("2026-10-07T10:00", {
      appointments: [
        {
          id: "a1",
          status: "CONFIRMED",
          appointment_datetime: "2026-10-07T06:45:00Z", // 09:45 Cyprus, 30 min
          duration_minutes: 30,
          proposed_slots: null,
          proposal_expires_at: null,
        },
      ],
    });
    assert.deepEqual(res.ok ? null : [res.status, res.code], [409, "slot_taken"]);
  });

  it("ignores declined and expired visits", async () => {
    const res = await check("2026-10-07T10:00", {
      appointments: [
        { id: "a1", status: "DECLINED", appointment_datetime: "2026-10-07T07:00:00Z", duration_minutes: 30 },
        { id: "a2", status: "EXPIRED", appointment_datetime: "2026-10-07T07:00:00Z", duration_minutes: 30 },
      ],
    });
    assert.equal(res.ok, true);
  });

  it("refuses an unreadable time", async () => {
    const res = await check("tomorrow at ten");
    assert.deepEqual(res.ok ? null : res.status, 400);
  });
});
