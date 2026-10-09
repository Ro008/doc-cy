import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  accountLimitsFor,
  applyLimitsToAllClinics,
  clinicsShareLimits,
  initialClinicLimits,
  PER_CLINIC_LIMITS_PENDING,
  setClinicLimit,
} from "../../lib/settings-clinic-limits";
import { buildSettingsSavePayload } from "../../lib/settings-save-groups";
import type { SettingsDirtySnapshot } from "../../lib/settings-form-dirty";

/**
 * Booking limits per clinic (user, 2026-10-09): how far ahead, minimum notice and the
 * online cancellation deadline are set on each clinic, with one "Apply to all my
 * clinics". Until Livio stores them per clinic, the backend keeps one value per
 * professional: a change then shows on every clinic and the UI says so.
 */

const account = { bookingHorizonDays: 30, minimumNoticeHours: 2, patientCancelNoticeHours: 12 };

describe("initialClinicLimits", () => {
  it("falls back to the account limits while the backend has none per clinic", () => {
    const state = initialClinicLimits([{ id: "a" }, { id: "b" }], account);
    assert.equal(state.perClinicSaved, false);
    assert.deepEqual(state.byClinic.a, account);
    assert.deepEqual(state.byClinic.b, account);
  });

  it("uses each clinic's own limits once the backend sends them", () => {
    const own = { bookingHorizonDays: 90, minimumNoticeHours: 24, patientCancelNoticeHours: 48 };
    const state = initialClinicLimits([{ id: "a", bookingLimits: own }, { id: "b" }], account);
    assert.equal(state.perClinicSaved, true);
    assert.deepEqual(state.byClinic.a, own);
    assert.deepEqual(state.byClinic.b, account);
  });
});

describe("setClinicLimit", () => {
  const byClinic = { a: account, b: account };

  it("changes only that clinic once limits are saved per clinic", () => {
    const next = setClinicLimit(byClinic, "a", { minimumNoticeHours: 24 }, true);
    assert.equal(next.a.minimumNoticeHours, 24);
    assert.equal(next.b.minimumNoticeHours, 2);
  });

  it("changes every clinic while the backend keeps one value per professional", () => {
    const next = setClinicLimit(byClinic, "a", { minimumNoticeHours: 24 }, false);
    assert.equal(next.a.minimumNoticeHours, 24);
    assert.equal(next.b.minimumNoticeHours, 24);
  });
});

describe("applyLimitsToAllClinics", () => {
  it("copies one clinic's limits to every clinic", () => {
    const own = { bookingHorizonDays: 90, minimumNoticeHours: 24, patientCancelNoticeHours: 48 };
    const next = applyLimitsToAllClinics({ a: own, b: account, c: account }, "a");
    assert.deepEqual(next.b, own);
    assert.deepEqual(next.c, own);
    assert.ok(clinicsShareLimits(next));
  });
});

describe("clinicsShareLimits", () => {
  it("is false when any clinic differs", () => {
    assert.equal(clinicsShareLimits({ a: account, b: { ...account, bookingHorizonDays: 90 } }), false);
  });
  it("is true for a single clinic", () => {
    assert.ok(clinicsShareLimits({ a: account }));
  });
});

describe("accountLimitsFor", () => {
  it("takes the clinic just changed; no clinic ranks above another", () => {
    const own = { bookingHorizonDays: 90, minimumNoticeHours: 24, patientCancelNoticeHours: 48 };
    assert.deepEqual(accountLimitsFor({ a: account, b: own }, "b", account), own);
    assert.deepEqual(accountLimitsFor({}, "missing", account), account);
  });
});

describe("PER_CLINIC_LIMITS_PENDING", () => {
  it("names what Livio has to build", () => {
    assert.match(PER_CLINIC_LIMITS_PENDING, /Livio/);
    assert.match(PER_CLINIC_LIMITS_PENDING, /professional_clinics/);
  });
});

describe("buildSettingsSavePayload with per-clinic limits", () => {
  const schedule = Object.fromEntries(
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((d) => [
      d,
      { enabled: d === "monday", start: "09:00", end: "17:00" },
    ]),
  ) as unknown as SettingsDirtySnapshot["workplaces"][number]["weeklySchedule"];
  const row = (id: string) => ({
    id,
    label: id,
    district: "",
    clinicAddress: "",
    clinicLatitude: null,
    clinicLongitude: null,
    clinicPlaceId: null,
    weeklySchedule: schedule,
    breakEnabled: false,
    breakStart: "",
    breakEnd: "",
    slotDurationMinutes: 30,
  });
  const snapshot: SettingsDirtySnapshot = {
    specialty: "",
    specialtyFromMaster: true,
    bio: "",
    languages: ["English"],
    mobileNumber: "",
    ...account,
    holidayModeEnabled: false,
    holidayStartInput: "",
    holidayEndInput: "",
    workplaces: [row("primary"), row("loc-2")],
  };

  it("sends each clinic's limits on its location", () => {
    const own = { bookingHorizonDays: 90, minimumNoticeHours: 24, patientCancelNoticeHours: 48 };
    const payload = buildSettingsSavePayload("doc", snapshot, { primary: account, "loc-2": own });
    const locations = payload.locations as Array<Record<string, unknown>>;
    assert.equal(locations[0].bookingHorizonDays, 30);
    assert.equal(locations[1].bookingHorizonDays, 90);
    assert.equal(locations[1].minimumNoticeHours, 24);
    assert.equal(locations[1].patientCancelNoticeHours, 48);
  });

  it("leaves locations without limits when none are given", () => {
    const payload = buildSettingsSavePayload("doc", snapshot);
    const locations = payload.locations as Array<Record<string, unknown>>;
    assert.equal("bookingHorizonDays" in locations[0], false);
  });
});
