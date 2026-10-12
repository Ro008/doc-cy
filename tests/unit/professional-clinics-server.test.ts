import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { DIRECTORY_CANARIES } from "../../lib/directory-canaries";
import { MAX_DOCTOR_LOCATIONS, sortDoctorLocations } from "../../lib/doctor-locations";
import {
  joinProfessionalClinic,
  leaveProfessionalClinic,
  saveClinicHours,
  saveClinicLimits,
  setClinicOnlineBooking,
} from "../../lib/professional-clinics-server";
import {
  holidayBannerText,
  holidayDatesProblem,
  holidayRangeUtc,
  holidayState,
  holidayVisitNotes,
} from "../../lib/holiday-mode";
import { saveHoliday } from "../../lib/professional-holiday-server";
import { LEAVE_CLINIC_LOSES, leaveClinicNotes } from "../../lib/settings-leave-clinic";

/**
 * Settings → Clinics (user, 2026-10-11): she joins a clinic DocCy has and leaves one at
 * once, no founder; the database functions make the change and its record together.
 */

type Call = { fn: string; args: Record<string, unknown> };

function fakeService(result: { data?: unknown; error?: { code: string; message?: string } | null }) {
  const calls: Call[] = [];
  const service = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data: result.data ?? null, error: result.error ?? null };
    },
  } as unknown as SupabaseClient;
  return { service, calls };
}

const PRO = "11111111-1111-4111-8111-111111111111";
const CLINIC = "22222222-2222-4222-8222-222222222222";
const LINK = "33333333-3333-4333-8333-333333333333";

describe("joinProfessionalClinic", () => {
  it("joins through the database function and answers with her link", async () => {
    const { service, calls } = fakeService({ data: { request_id: "r", link_id: LINK, clinic_id: CLINIC } });
    const result = await joinProfessionalClinic(service, { professionalId: PRO, clinicId: CLINIC });
    assert.deepEqual(result, { ok: true, linkId: LINK });
    assert.deepEqual(calls, [
      { fn: "professional_clinic_join", args: { p_professional_id: PRO, p_clinic_id: CLINIC } },
    ]);
  });

  it("says so when the clinic is already hers", async () => {
    const { service } = fakeService({ error: { code: "23505" } });
    assert.deepEqual(await joinProfessionalClinic(service, { professionalId: PRO, clinicId: CLINIC }), {
      ok: false,
      status: 409,
      message: "You already work at this clinic.",
    });
  });

  it("says so when she has the most clinics allowed", async () => {
    const { service } = fakeService({ error: { code: "23514" } });
    const result = await joinProfessionalClinic(service, { professionalId: PRO, clinicId: CLINIC });
    assert.equal(result.ok === false && result.status, 409);
    assert.equal(
      result.ok === false && result.message,
      `You can have up to ${MAX_DOCTOR_LOCATIONS} clinics. Leave one to add another.`,
    );
  });

  it("does not find an unknown or archived clinic, nor something that is not an id", async () => {
    for (const code of ["P0002", "22P02"]) {
      const { service } = fakeService({ error: { code } });
      const result = await joinProfessionalClinic(service, { professionalId: PRO, clinicId: CLINIC });
      assert.equal(result.ok === false && result.status, 404, code);
    }
    const { service, calls } = fakeService({ data: null });
    const result = await joinProfessionalClinic(service, { professionalId: PRO, clinicId: "  " });
    assert.equal(result.ok === false && result.status, 404);
    assert.equal(calls.length, 0);
  });

  it("never joins a canary clinic", async () => {
    const canaryClinicId = DIRECTORY_CANARIES[0]!.clinicId;
    const { service, calls } = fakeService({ data: { link_id: LINK } });
    const result = await joinProfessionalClinic(service, { professionalId: PRO, clinicId: canaryClinicId });
    assert.equal(result.ok === false && result.status, 404);
    assert.equal(calls.length, 0);
  });

  it("fails plainly on anything else", async () => {
    const { service } = fakeService({ error: { code: "XX000", message: "boom" } });
    const result = await joinProfessionalClinic(service, { professionalId: PRO, clinicId: CLINIC });
    assert.equal(result.ok === false && result.status, 500);
    const odd = fakeService({ data: { nothing: true } });
    const oddResult = await joinProfessionalClinic(odd.service, { professionalId: PRO, clinicId: CLINIC });
    assert.equal(oddResult.ok === false && oddResult.status, 500);
  });
});

describe("leaveProfessionalClinic", () => {
  it("leaves through the database function, by her link to the clinic", async () => {
    const { service, calls } = fakeService({ data: "request-id" });
    assert.deepEqual(await leaveProfessionalClinic(service, { professionalId: PRO, linkId: LINK }), { ok: true });
    assert.deepEqual(calls, [
      { fn: "professional_clinic_leave", args: { p_professional_id: PRO, p_link_id: LINK } },
    ]);
  });

  it("keeps her last clinic, and says how to change clinic", async () => {
    const { service } = fakeService({ error: { code: "23514" } });
    assert.deepEqual(await leaveProfessionalClinic(service, { professionalId: PRO, linkId: LINK }), {
      ok: false,
      status: 409,
      message: "You need at least one clinic. To change clinic, add the new one first, then leave this one.",
    });
  });

  it("does not find a clinic that is not hers", async () => {
    for (const code of ["P0002", "22P02"]) {
      const { service } = fakeService({ error: { code } });
      const result = await leaveProfessionalClinic(service, { professionalId: PRO, linkId: LINK });
      assert.equal(result.ok === false && result.status, 404, code);
    }
  });
});

describe("the Leave clinic dialog", () => {
  it("says what she loses there", () => {
    assert.equal(
      LEAVE_CLINIC_LOSES,
      "Patients won’t find you at this clinic any more, and your hours, slot length and booking limits there are removed. The clinic itself stays in DocCy.",
    );
  });

  it("says nothing more when no visit is coming", () => {
    assert.deepEqual(leaveClinicNotes({ confirmed: 0, open: 0 }), []);
  });

  it("says confirmed visits stay", () => {
    assert.deepEqual(leaveClinicNotes({ confirmed: 1, open: 0 }), [
      "1 confirmed visit at this clinic stays in your agenda.",
    ]);
    assert.deepEqual(leaveClinicNotes({ confirmed: 3, open: 0 }), [
      "3 confirmed visits at this clinic stay in your agenda.",
    ]);
  });

  it("says open requests can only be accepted or declined afterwards", () => {
    assert.deepEqual(leaveClinicNotes({ confirmed: 0, open: 1 }), [
      "1 request at this clinic is waiting for your answer. After you leave, you can only accept or decline it. To suggest other times, do it before leaving.",
    ]);
    assert.deepEqual(leaveClinicNotes({ confirmed: 2, open: 4 }), [
      "2 confirmed visits at this clinic stay in your agenda.",
      "4 requests at this clinic are waiting for your answer. After you leave, you can only accept or decline them. To suggest other times, do it before leaving.",
    ]);
  });
});

describe("the order of her clinics", () => {
  it("is sort_order, then the date she joined: there is no primary clinic", () => {
    const rows = [
      { id: "late", sort_order: 1, created_at: "2026-03-01" },
      { id: "second", sort_order: 0, created_at: "2026-02-01" },
      { id: "first", sort_order: 0, created_at: "2026-01-01" },
    ];
    assert.deepEqual(
      sortDoctorLocations(rows).map((row) => row.id),
      ["first", "second", "late"],
    );
    // A leftover is_primary flag changes nothing.
    const flagged = [{ id: "a", sort_order: 1, is_primary: true }, { id: "b", sort_order: 0 }];
    assert.deepEqual(
      sortDoctorLocations(flagged).map((row) => row.id),
      ["b", "a"],
    );
  });
});

describe("her hours, limits and online-booking switch at a clinic (stage 3)", () => {
  const HOURS = {
    monday: true,
    start_time: "09:00:00",
    end_time: "17:00:00",
    weekly_schedule: { monday: { enabled: true, start_time: "09:00:00", end_time: "17:00:00" } },
    slot_duration_minutes: 30,
    // Never part of the hours: the switch and the name have their own ways.
    pause_online_bookings: false,
    label: "Mine",
  };

  it("saves the hours through the database function, which records the change", async () => {
    const { service, calls } = fakeService({ data: "request-id" });
    const result = await saveClinicHours(service, { professionalId: PRO, linkId: LINK, hours: HOURS });
    assert.deepEqual(result, { ok: true, changed: true });
    const { pause_online_bookings: _pause, label: _label, ...sent } = HOURS;
    assert.deepEqual(calls, [
      { fn: "professional_clinic_hours_set", args: { p_professional_id: PRO, p_link_id: LINK, p_hours: sent } },
    ]);
  });

  it("says nothing changed when the function recorded nothing", async () => {
    const { service } = fakeService({ data: null });
    assert.deepEqual(await saveClinicHours(service, { professionalId: PRO, linkId: LINK, hours: HOURS }), {
      ok: true,
      changed: false,
    });
  });

  it("refuses hours the database cannot read, and a clinic that is not hers", async () => {
    const bad = await saveClinicHours(fakeService({ error: { code: "22023" } }).service, {
      professionalId: PRO,
      linkId: LINK,
      hours: HOURS,
    });
    assert.equal(bad.ok === false && bad.status, 400);
    const notHers = await saveClinicHours(fakeService({ error: { code: "P0002" } }).service, {
      professionalId: PRO,
      linkId: LINK,
      hours: HOURS,
    });
    assert.equal(notHers.ok === false && notHers.status, 404);
  });

  it("saves the limits of one clinic; a limit left out is kept", async () => {
    const { service, calls } = fakeService({ data: "request-id" });
    const result = await saveClinicLimits(service, {
      professionalId: PRO,
      linkId: LINK,
      limits: { bookingHorizonDays: 30, patientCancelNoticeHours: 48 },
    });
    assert.deepEqual(result, { ok: true, changed: true });
    assert.deepEqual(calls, [
      {
        fn: "professional_clinic_limits_set",
        args: {
          p_professional_id: PRO,
          p_link_id: LINK,
          p_booking_horizon_days: 30,
          p_minimum_notice_hours: null,
          p_patient_cancel_notice_hours: 48,
        },
      },
    ]);
  });

  it("refuses a limit that is not on the list", async () => {
    const { service } = fakeService({ error: { code: "22023" } });
    const result = await saveClinicLimits(service, {
      professionalId: PRO,
      linkId: LINK,
      limits: { bookingHorizonDays: 45 },
    });
    assert.equal(result.ok === false && result.status, 400);
    assert.equal(result.ok === false && result.message, "Choose one of the listed booking limits.");
  });

  it("switches online booking on or off through the function", async () => {
    const { service, calls } = fakeService({ data: "request-id" });
    assert.deepEqual(await setClinicOnlineBooking(service, { professionalId: PRO, linkId: LINK, online: false }), {
      ok: true,
      changed: true,
    });
    assert.deepEqual(calls, [
      {
        fn: "professional_clinic_online_booking_set",
        args: { p_professional_id: PRO, p_link_id: LINK, p_online_booking: false },
      },
    ]);
    const notHers = await setClinicOnlineBooking(fakeService({ error: { code: "P0002" } }).service, {
      professionalId: PRO,
      linkId: LINK,
      online: true,
    });
    assert.equal(notHers.ok === false && notHers.status, 404);
  });
});

/**
 * Holiday mode (user, 2026-10-11): no founder, recorded; it cannot start in the past or
 * end before it starts (a running one keeps its start); once its end date has passed it
 * counts as off; saving warns about the visits in its dates and cancels nothing.
 */
describe("holidayState", () => {
  const dates = { enabled: true, start: "2026-10-20", end: "2026-10-25" };

  it("is upcoming before its first day, active on its days, off afterwards", () => {
    assert.deepEqual(holidayState(dates, "2026-10-19"), { kind: "upcoming", start: "2026-10-20", end: "2026-10-25" });
    assert.deepEqual(holidayState(dates, "2026-10-20"), { kind: "active", start: "2026-10-20", end: "2026-10-25" });
    assert.deepEqual(holidayState(dates, "2026-10-25"), { kind: "active", start: "2026-10-20", end: "2026-10-25" });
    assert.deepEqual(holidayState(dates, "2026-10-26"), { kind: "off" });
  });

  it("is off when switched off or without both dates", () => {
    assert.deepEqual(holidayState({ ...dates, enabled: false }, "2026-10-21"), { kind: "off" });
    assert.deepEqual(holidayState({ enabled: true, start: "2026-10-20", end: null }, "2026-10-21"), { kind: "off" });
  });
});

describe("holidayBannerText", () => {
  it("names both dates while it runs", () => {
    assert.equal(
      holidayBannerText({ kind: "active", start: "2026-10-20", end: "2026-10-25" }),
      "Holiday mode is on from 20/10/2026 until 25/10/2026. Patients cannot book online for those days.",
    );
  });

  it("announces a holiday that has not started", () => {
    assert.equal(
      holidayBannerText({ kind: "upcoming", start: "2026-10-20", end: "2026-10-25" }),
      "Holiday mode starts on 20/10/2026 and runs until 25/10/2026. Patients cannot book online for those days.",
    );
  });

  it("says nothing when off", () => {
    assert.equal(holidayBannerText({ kind: "off" }), null);
  });
});

describe("holidayDatesProblem", () => {
  const off = { enabled: false, start: null, end: null };
  const today = "2026-10-12";

  it("accepts a holiday from today on", () => {
    assert.equal(holidayDatesProblem({ start: "2026-10-12", end: "2026-10-12" }, off, today), null);
    assert.equal(holidayDatesProblem({ start: "2026-10-20", end: "2026-10-25" }, off, today), null);
  });

  it("needs both dates, in order", () => {
    assert.equal(holidayDatesProblem({ start: "2026-10-20", end: null }, off, today), "Pick both holiday dates.");
    assert.equal(
      holidayDatesProblem({ start: "2026-10-25", end: "2026-10-20" }, off, today),
      "The holiday must end on or after the day it starts.",
    );
  });

  it("refuses a start in the past", () => {
    assert.equal(
      holidayDatesProblem({ start: "2026-10-11", end: "2026-10-20" }, off, today),
      "The holiday cannot start in the past.",
    );
  });

  it("lets a running holiday keep its start and move its end, not below today", () => {
    const running = { enabled: true, start: "2026-10-09", end: "2026-10-14" };
    assert.equal(holidayDatesProblem({ start: "2026-10-09", end: "2026-10-18" }, running, today), null);
    assert.equal(holidayDatesProblem({ start: "2026-10-09", end: "2026-10-12" }, running, today), null);
    assert.equal(
      holidayDatesProblem({ start: "2026-10-10", end: "2026-10-18" }, running, today),
      "The holiday cannot start in the past.",
    );
    assert.equal(
      holidayDatesProblem({ start: "2026-10-09", end: "2026-10-11" }, running, today),
      "The holiday cannot end in the past.",
    );
  });

  it("does not let a finished holiday come back with its old start", () => {
    const finished = { enabled: true, start: "2026-10-01", end: "2026-10-05" };
    assert.equal(
      holidayDatesProblem({ start: "2026-10-01", end: "2026-10-20" }, finished, today),
      "The holiday cannot start in the past.",
    );
  });
});

describe("holidayVisitNotes", () => {
  it("says what falls in the dates, and that nothing is cancelled", () => {
    assert.deepEqual(holidayVisitNotes({ confirmed: 0, open: 0 }), []);
    assert.deepEqual(holidayVisitNotes({ confirmed: 1, open: 0 }), [
      "1 confirmed visit falls in these dates. It stays in your agenda: holiday mode cancels nothing.",
    ]);
    assert.deepEqual(holidayVisitNotes({ confirmed: 3, open: 2 }), [
      "3 confirmed visits fall in these dates. They stay in your agenda: holiday mode cancels nothing.",
      "2 requests in these dates are waiting for your answer.",
    ]);
    assert.deepEqual(holidayVisitNotes({ confirmed: 0, open: 1 }), [
      "1 request in these dates is waiting for your answer.",
    ]);
  });
});

describe("holidayRangeUtc", () => {
  it("covers the Cyprus days from the first midnight to the one after the last", () => {
    // Cyprus is UTC+3 in summer and UTC+2 in winter.
    assert.deepEqual(holidayRangeUtc("2026-10-20", "2026-10-21"), {
      from: "2026-10-19T21:00:00.000Z",
      to: "2026-10-21T21:00:00.000Z",
    });
    assert.deepEqual(holidayRangeUtc("2026-12-24", "2026-12-24"), {
      from: "2026-12-23T22:00:00.000Z",
      to: "2026-12-24T22:00:00.000Z",
    });
  });
});

describe("saveHoliday", () => {
  it("saves through the database function and says whether anything changed", async () => {
    const { service, calls } = fakeService({ data: "request-id" });
    assert.deepEqual(
      await saveHoliday(service, { professionalId: PRO, enabled: true, startDate: "2026-10-20", endDate: "2026-10-25" }),
      { ok: true, changed: true },
    );
    assert.deepEqual(calls, [
      {
        fn: "professional_holiday_set",
        args: { p_professional_id: PRO, p_enabled: true, p_start_date: "2026-10-20", p_end_date: "2026-10-25" },
      },
    ]);
  });

  it("sends no dates when switching off, and reports an unchanged save", async () => {
    const { service, calls } = fakeService({ data: null });
    assert.deepEqual(
      await saveHoliday(service, { professionalId: PRO, enabled: false, startDate: "2026-10-20", endDate: "2026-10-25" }),
      { ok: true, changed: false },
    );
    assert.deepEqual(calls[0].args, {
      p_professional_id: PRO,
      p_enabled: false,
      p_start_date: null,
      p_end_date: null,
    });
  });

  it("answers 400 when the database refuses the dates", async () => {
    const { service } = fakeService({ error: { code: "22023", message: "a holiday cannot start in the past" } });
    assert.deepEqual(
      await saveHoliday(service, { professionalId: PRO, enabled: true, startDate: "2026-10-01", endDate: "2026-10-25" }),
      {
        ok: false,
        status: 400,
        message: "Check the holiday dates: it cannot start in the past or end before it starts.",
      },
    );
  });

  it("answers 500 on any other failure", async () => {
    const { service } = fakeService({ error: { code: "XX000" } });
    const result = await saveHoliday(service, {
      professionalId: PRO,
      enabled: true,
      startDate: "2026-10-20",
      endDate: "2026-10-25",
    });
    assert.deepEqual(result, { ok: false, status: 500, message: "Could not save holiday mode. Please try again." });
  });
});
