import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { zonedTimeToUtc } from "date-fns-tz";

import { CY_TZ } from "../../lib/appointments";
import type { DoctorLocationRow } from "../../lib/doctor-locations";
import type { ProfessionalAccountSettings } from "../../lib/professional-account-settings";
import type { PublicAvailabilityCalendar } from "../../lib/public/compute-public-booking-slots";
import {
  OCCUPIED_BATCH_RPC,
  loadFinderCardAvailabilityByDoctorId,
  takenSlotTimesFor,
} from "../../lib/public/load-doctor-next-available-slot";

/**
 * The finder used to call public_doctor_occupied_datetimes once per card and
 * clinic (32% of Testing's database time). It now makes one batch call per
 * page and splits the rows by professional and clinic in code.
 */

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const L1 = "11111111-0000-4000-8000-000000000001";
const L2 = "22222222-0000-4000-8000-000000000002";
const L3 = "33333333-0000-4000-8000-000000000003";
const L4 = "44444444-0000-4000-8000-000000000004";
const C = "cccccccc-0000-4000-8000-000000000003";

const allWeek = {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: true,
  sunday: true,
  start_time: "08:00:00",
  end_time: "20:00:00",
  weekly_schedule: null,
  break_start: null,
  break_end: null,
  slot_duration_minutes: 30,
};

// professional_settings holds the account settings only (Point E6).
function settingsRow(professionalId: string): ProfessionalAccountSettings {
  return {
    professional_id: professionalId,
    holiday_mode_enabled: false,
    holiday_start_date: null,
    holiday_end_date: null,
    booking_horizon_days: 30,
    minimum_notice_hours: 1,
  };
}

function location(id: string, paused = false, doctorId = A): DoctorLocationRow {
  return {
    id,
    doctor_id: doctorId,
    is_primary: id === L1 || id === L4,
    sort_order: 0,
    label: null,
    district: "Paphos",
    clinic_address: `Address ${id.slice(0, 4)}`,
    town: null,
    latitude: null,
    longitude: null,
    clinic_place_id: null,
    pause_online_bookings: paused,
    ...allWeek,
  };
}

type OccupiedRow = {
  professional_id: string;
  location_id: string | null;
  appointment_datetime: string;
};

function fakeSupabase(occupied: OccupiedRow[] | "error") {
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  const client = {
    from() {
      return {
        select() {
          return {
            in: async () => ({ data: [settingsRow(A), settingsRow(B)], error: null }),
          };
        },
      };
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      if (occupied === "error") return { data: null, error: { message: "boom" } };
      return { data: occupied, error: null };
    },
  };
  return { supabase: client as unknown as SupabaseClient, rpcCalls };
}

const loadLocations = async () =>
  new Map<string, DoctorLocationRow[]>([
    [A, [location(L1), location(L2), location(L3, true)]],
    [B, [location(L4, false, B)]],
  ]);

function slotKeys(calendar: PublicAvailabilityCalendar | undefined): string[] {
  return (calendar?.days ?? []).flatMap((day) => day.slots.map((slot) => slot.slotKey));
}

function isoFromSlotKey(slotKey: string): string {
  return zonedTimeToUtc(`${slotKey}:00`, CY_TZ).toISOString();
}

describe("finder availability batch", () => {
  it("makes one occupied-times call for every professional on the page", async () => {
    const { supabase, rpcCalls } = fakeSupabase([]);
    await loadFinderCardAvailabilityByDoctorId(supabase, [A, B, A], undefined, { loadLocations });

    assert.equal(rpcCalls.length, 1);
    assert.equal(rpcCalls[0].name, OCCUPIED_BATCH_RPC);
    assert.deepEqual([...(rpcCalls[0].args.p_professional_ids as string[])].sort(), [A, B]);
  });

  it("makes no call when every clinic is paused", async () => {
    const { supabase, rpcCalls } = fakeSupabase([]);
    await loadFinderCardAvailabilityByDoctorId(supabase, [A], undefined, {
      loadLocations: async () => new Map([[A, [location(L3, true)]]]),
    });
    assert.equal(rpcCalls.length, 0);
  });

  // One agenda per professional: a visit at one clinic takes that time at all of them.
  it("removes a booked slot at every clinic of that professional", async () => {
    const baseline = await loadFinderCardAvailabilityByDoctorId(
      fakeSupabase([]).supabase,
      [A, B],
      undefined,
      { loadLocations },
    );
    const slotAtL1 = slotKeys(baseline.byLocationId.get(L1)?.calendar)[0];
    const slotForB = slotKeys(baseline.calendars.get(B))[0];
    assert.ok(slotAtL1, "baseline has a slot at L1");
    assert.ok(slotForB, "baseline has a slot for B");

    const { supabase } = fakeSupabase([
      { professional_id: A, location_id: L1, appointment_datetime: isoFromSlotKey(slotAtL1) },
      { professional_id: B, location_id: L4, appointment_datetime: isoFromSlotKey(slotForB) },
    ]);
    const result = await loadFinderCardAvailabilityByDoctorId(supabase, [A, B], undefined, {
      loadLocations,
    });

    assert.ok(!slotKeys(result.byLocationId.get(L1)?.calendar).includes(slotAtL1), "taken at L1");
    assert.ok(!slotKeys(result.byLocationId.get(L2)?.calendar).includes(slotAtL1), "taken at L2 too");
    assert.ok(!slotKeys(result.calendars.get(B)).includes(slotForB), "taken for B");
    assert.equal(result.byLocationId.get(L3)?.paused, true);
    assert.equal(result.paused.get(A), false);
  });

  it("a professional with no clinic has nothing to book (the schedule is on the clinic)", async () => {
    const { supabase, rpcCalls } = fakeSupabase([]);
    const result = await loadFinderCardAvailabilityByDoctorId(supabase, [C], undefined, {
      loadLocations: async () => new Map([[C, []]]),
    });
    assert.equal(rpcCalls.length, 0);
    assert.equal(result.paused.get(C), true);
    assert.deepEqual(slotKeys(result.calendars.get(C)), []);
  });

  // Access ended (user, 2026-10-02): nothing new can be booked, so no calendar is offered.
  it("offers no calendar for a professional whose pro access has ended", async () => {
    const { supabase, rpcCalls } = fakeSupabase([]);
    const result = await loadFinderCardAvailabilityByDoctorId(supabase, [A, B], undefined, {
      loadLocations,
      loadAccessEndedIds: async () => new Set([A]),
    });

    assert.equal(result.paused.get(A), true);
    assert.deepEqual(slotKeys(result.calendars.get(A)), []);
    assert.equal(result.byLocationId.get(L1)?.paused, true);
    assert.equal(result.byLocationId.get(L2)?.paused, true);
    assert.equal(result.paused.get(B), false);
    assert.ok(slotKeys(result.calendars.get(B)).length > 0, "B keeps her calendar");
    assert.deepEqual(rpcCalls[0].args.p_professional_ids, [B], "no occupancy lookup for A");
  });

  it("makes no occupied-times call when everyone on the page has ended access", async () => {
    const { supabase, rpcCalls } = fakeSupabase([]);
    await loadFinderCardAvailabilityByDoctorId(supabase, [A, B], undefined, {
      loadLocations,
      loadAccessEndedIds: async () => new Set([A, B]),
    });
    assert.equal(rpcCalls.length, 0);
  });

  it("shows no availability when the batch call fails", async () => {
    const { supabase } = fakeSupabase("error");
    const result = await loadFinderCardAvailabilityByDoctorId(supabase, [A, B], undefined, {
      loadLocations,
    });
    assert.deepEqual(slotKeys(result.byLocationId.get(L1)?.calendar), []);
    assert.deepEqual(slotKeys(result.calendars.get(B)), []);
  });
});

describe("takenSlotTimesFor", () => {
  const rows: OccupiedRow[] = [
    { professional_id: A, location_id: L1, appointment_datetime: "2026-10-01T07:00:00+00:00" },
    { professional_id: A, location_id: L2, appointment_datetime: "2026-10-01T08:00:00+00:00" },
    { professional_id: A, location_id: L1, appointment_datetime: "2026-10-01T07:00:00+00:00" },
    { professional_id: B, location_id: null, appointment_datetime: "2026-10-01T09:00:00+00:00" },
    { professional_id: A, location_id: L1, appointment_datetime: "2026-12-31T07:00:00+00:00" },
  ];
  const to = "2026-11-01T00:00:00.000Z";

  it("keeps one professional's rows from every clinic, deduplicated, in Cyprus time, within their horizon", () => {
    assert.deepEqual(takenSlotTimesFor(rows, { professionalId: A, toIso: to }), [
      "2026-10-01T10:00",
      "2026-10-01T11:00",
    ]);
  });

  it("keeps rows up to a longer horizon", () => {
    const result = takenSlotTimesFor(rows, {
      professionalId: A,
      toIso: "2027-01-31T00:00:00.000Z",
    });
    assert.ok(result.includes("2026-12-31T09:00"));
  });
});
