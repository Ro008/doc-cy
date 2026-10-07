import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  agendaClosedBands,
  agendaOpenIntervals,
  clinicIdForAppointment,
  locationsToAgendaClinics,
  unionAgendaWorkingWindows,
  workingWindowForHours,
  type AgendaWorkingHours,
} from "../../lib/agenda-clinics";
import { agendaClinicVisibilityMessage } from "../../components/agenda/AgendaClinicCalendars";
import { agendaClinicEventColor } from "../../lib/doctor-locations";
import type { WeeklySchedule } from "../../lib/doctor-settings";

const weekly: WeeklySchedule = {
  monday: { enabled: true, start_time: "09:00:00", end_time: "17:00:00" },
  tuesday: { enabled: true, start_time: "10:00:00", end_time: "18:00:00" },
  wednesday: { enabled: false, start_time: "09:00:00", end_time: "17:00:00" },
  thursday: { enabled: true, start_time: "09:00:00", end_time: "13:00:00" },
  friday: { enabled: true, start_time: "09:00:00", end_time: "17:00:00" },
  saturday: { enabled: false, start_time: "09:00:00", end_time: "13:00:00" },
  sunday: { enabled: false, start_time: "09:00:00", end_time: "13:00:00" },
};

const hoursA: AgendaWorkingHours = {
  weeklySchedule: weekly,
  breakStart: "13:00",
  breakEnd: "14:00",
  slotDurationMinutes: 30,
};

const hoursB: AgendaWorkingHours = {
  weeklySchedule: {
    ...weekly,
    monday: { enabled: true, start_time: "08:00:00", end_time: "12:00:00" },
  },
  breakStart: null,
  breakEnd: null,
  slotDurationMinutes: 20,
};

describe("agenda clinics", () => {
  it("maps an appointment's clinic (clinics.id) to her clinic link, else the primary", () => {
    const clinics = [
      { id: "link-primary", clinicId: "clinic-a" },
      { id: "link-second", clinicId: "clinic-b" },
    ];
    assert.equal(clinicIdForAppointment(null, clinics), "link-primary");
    assert.equal(clinicIdForAppointment("clinic-b", clinics), "link-second");
    assert.equal(clinicIdForAppointment("missing", clinics), "link-primary");
    // A link id is not a clinic id (appointments store clinics.id, user 2026-10-02).
    assert.equal(clinicIdForAppointment("link-second", clinics), "link-primary");
  });

  it("names each clinic after the clinic itself, not the link label", () => {
    const base = {
      professional_id: "p",
      is_primary: true,
      sort_order: 0,
      pause_online_bookings: false,
      weekly_schedule: null,
      break_start: null,
      break_end: null,
      slot_duration_minutes: 30,
    };
    const clinics = locationsToAgendaClinics([
      { ...base, id: "l1", clinic_id: "c1", clinic_name: "Evangelismos", label: "Old label" },
      { ...base, id: "l2", clinic_id: "c2", clinic_name: null, label: "Coast", is_primary: false, sort_order: 1 },
    ] as never);
    assert.deepEqual(
      clinics.map((c) => [c.id, c.clinicId, c.name]),
      [
        ["l1", "c1", "Evangelismos"],
        ["l2", "c2", "Coast"],
      ],
    );
  });

  it("unions visible clinic hours and keeps a single clinic’s break", () => {
    const monday = new Date(2026, 7, 24); // Monday
    const a = workingWindowForHours(hoursA, monday, 8, 20);
    const b = workingWindowForHours(hoursB, monday, 8, 20);
    assert.equal(a.enabled, true);
    assert.equal(a.start, 9 * 60);
    assert.equal(a.breakStart, 13 * 60);
    const union = unionAgendaWorkingWindows([a, b]);
    assert.equal(union.enabled, true);
    assert.equal(union.start, 8 * 60);
    assert.equal(union.end, 17 * 60);
    assert.equal(union.breakStart, null);
    const wednesday = new Date(2026, 7, 26);
    const closed = unionAgendaWorkingWindows([
      workingWindowForHours(hoursA, wednesday, 8, 20),
      workingWindowForHours(hoursA, wednesday, 8, 20),
    ]);
    assert.equal(closed.enabled, false);
  });

  it("keeps a distinct color per clinic on the agenda overlay", () => {
    assert.equal(agendaClinicEventColor(0).swatch.includes("clinical-400"), true);
    assert.equal(agendaClinicEventColor(1).swatch.includes("violet-400"), true);
    assert.notEqual(agendaClinicEventColor(0).swatch, agendaClinicEventColor(1).swatch);

    const agenda = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "../../components/agenda/AgendaRealtime.tsx"),
      "utf8",
    );
    assert.equal(agenda.includes("AgendaClinicCalendars"), true);
    assert.equal(agenda.includes("clinicSwatchClass"), true);
    assert.equal(agenda.includes("agendaAppointmentPendingClass"), true);
    assert.equal(agenda.includes("agendaAppointmentConfirmedClass"), true);
    assert.equal(agenda.includes("color.pending"), false);
    assert.equal(agenda.includes("color.confirmed"), false);
    const calendarsUi = fs.readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../components/agenda/AgendaClinicCalendars.tsx",
      ),
      "utf8",
    );
    assert.equal(calendarsUi.includes("agenda-clinic-visibility"), true);
    assert.equal(calendarsUi.includes("You're viewing appointments for your"), true);
    assert.equal(calendarsUi.includes("No calendars selected."), true);
    const page = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "../../app/agenda/(calendar)/page.tsx"),
      "utf8",
    );
    assert.equal(page.includes("locationsToAgendaClinics"), true);
    const manual = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "../../components/agenda/ManualBookingFlow.tsx"),
      "utf8",
    );
    assert.equal(manual.includes("manual-booking-clinic-picker"), true);
  });

  it("explains which clinic calendars are visible", () => {
    const clinics = [
      { id: "a", name: "Clinic 1" },
      { id: "b", name: "Clinic 2" },
      { id: "c", name: "Makarios" },
    ];
    assert.deepEqual(agendaClinicVisibilityMessage(clinics, new Set()), {
      tone: "active",
      text: "You're viewing appointments for your clinics Clinic 1, Clinic 2, and Makarios.",
    });
    assert.deepEqual(
      agendaClinicVisibilityMessage(clinics, new Set(["b", "c"])),
      {
        tone: "active",
        text: "You're viewing appointments for your clinic Clinic 1.",
      },
    );
    assert.deepEqual(
      agendaClinicVisibilityMessage(clinics, new Set(["a", "b", "c"])),
      {
        tone: "empty",
        text: "No calendars selected. Turn one on to see appointments.",
      },
    );
    assert.equal(agendaClinicVisibilityMessage([{ id: "only", name: "Clinic 1" }], new Set()), null);
  });
});

describe("AGENDA_VISIBLE_STATUSES", () => {
  // Declined, cancelled and expired visits are kept (never deleted) but leave the agenda.
  it("shows only live visits", async () => {
    const { AGENDA_VISIBLE_STATUSES } = await import("../../lib/agenda-clinics");
    assert.deepEqual([...AGENDA_VISIBLE_STATUSES], ["REQUESTED", "NEEDS_RESCHEDULE", "CONFIRMED"]);
  });
});

// Hatched where no shown clinic is open, counting each clinic's own break; gaps between
// two clinics' hours are hatched too (user, 2026-10-07).
describe("agendaOpenIntervals", () => {
  const w = (enabled: boolean, start: number, end: number, breakStart: number | null = null, breakEnd: number | null = null) => ({
    enabled,
    start,
    end,
    breakStart,
    breakEnd,
  });

  it("is the working hours minus the break", () => {
    assert.deepEqual(agendaOpenIntervals(w(true, 540, 1020, 780, 840)), [
      { start: 540, end: 780 },
      { start: 840, end: 1020 },
    ]);
  });

  it("is nothing on a closed day", () => {
    assert.deepEqual(agendaOpenIntervals(w(false, 540, 1020)), []);
  });

  it("ignores a break outside the hours", () => {
    assert.deepEqual(agendaOpenIntervals(w(true, 540, 720, 780, 840)), [{ start: 540, end: 720 }]);
  });
});

describe("agendaClosedBands", () => {
  const w = (enabled: boolean, start: number, end: number, breakStart: number | null = null, breakEnd: number | null = null) => ({
    enabled,
    start,
    end,
    breakStart,
    breakEnd,
  });
  const GRID: [number, number] = [8 * 60, 20 * 60];

  it("hatches the whole day when no shown clinic opens", () => {
    assert.equal(agendaClosedBands([w(false, 540, 1020)], ...GRID), "closed");
    assert.equal(agendaClosedBands([], ...GRID), "closed");
  });

  it("one clinic: before, its break and after", () => {
    assert.deepEqual(agendaClosedBands([w(true, 540, 1020, 780, 840)], ...GRID), [
      { start: 480, end: 540, kind: "off" },
      { start: 780, end: 840, kind: "break" },
      { start: 1020, end: 1200, kind: "off" },
    ]);
  });

  it("no break band while the other clinic is open (Harrison: Feretis breaks, WellClub works)", () => {
    assert.deepEqual(agendaClosedBands([w(true, 540, 1020, 780, 840), w(true, 540, 1020)], ...GRID), [
      { start: 480, end: 540, kind: "off" },
      { start: 1020, end: 1200, kind: "off" },
    ]);
  });

  it("hatches the gap between two clinics' hours", () => {
    assert.deepEqual(agendaClosedBands([w(true, 540, 780), w(true, 900, 1140)], ...GRID), [
      { start: 480, end: 540, kind: "off" },
      { start: 780, end: 900, kind: "off" },
      { start: 1140, end: 1200, kind: "off" },
    ]);
  });

  it("a break both clinics share stays a break", () => {
    assert.deepEqual(agendaClosedBands([w(true, 540, 1020, 780, 840), w(true, 600, 1020, 780, 840)], ...GRID), [
      { start: 480, end: 540, kind: "off" },
      { start: 780, end: 840, kind: "break" },
      { start: 1020, end: 1200, kind: "off" },
    ]);
  });

  it("clips to the grid", () => {
    assert.deepEqual(agendaClosedBands([w(true, 420, 1260)], ...GRID), []);
  });
});
