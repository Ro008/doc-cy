import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  clinicIdForAppointment,
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
  it("maps unassigned appointments to the primary clinic", () => {
    const clinics = [{ id: "primary" }, { id: "second" }];
    assert.equal(clinicIdForAppointment(null, clinics), "primary");
    assert.equal(clinicIdForAppointment("second", clinics), "second");
    assert.equal(clinicIdForAppointment("missing", clinics), "primary");
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
      path.join(path.dirname(fileURLToPath(import.meta.url)), "../../app/agenda/page.tsx"),
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
