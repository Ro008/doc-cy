import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  accountLimitsFor,
  applyLimitsToAllClinics,
  clinicsShareLimits,
  initialClinicLimits,
  setClinicLimit,
} from "../../lib/settings-clinic-limits";
import { buildSettingsSavePayload } from "../../lib/settings-save-groups";
import type { SettingsDirtySnapshot } from "../../lib/settings-form-dirty";

/**
 * Booking limits per clinic (user, 2026-10-09; stored per clinic since 2026-10-11): how
 * far ahead, minimum notice and the online cancellation deadline are set on each
 * clinic, with one "Apply to all my clinics".
 */

const account = { bookingHorizonDays: 30, minimumNoticeHours: 2, patientCancelNoticeHours: 12 };

describe("initialClinicLimits", () => {
  it("uses each clinic's own limits", () => {
    const own = { bookingHorizonDays: 90, minimumNoticeHours: 24, patientCancelNoticeHours: 48 };
    const byClinic = initialClinicLimits([{ id: "a", bookingLimits: own }, { id: "b", bookingLimits: account }], account);
    assert.deepEqual(byClinic.a, own);
    assert.deepEqual(byClinic.b, account);
  });

  it("fills a clinic that arrived without limits", () => {
    assert.deepEqual(initialClinicLimits([{ id: "a" }], account).a, account);
  });
});

describe("setClinicLimit", () => {
  it("changes only that clinic", () => {
    const next = setClinicLimit({ a: account, b: account }, "a", { minimumNoticeHours: 24 });
    assert.equal(next.a.minimumNoticeHours, 24);
    assert.equal(next.b.minimumNoticeHours, 2);
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
