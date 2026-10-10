import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  createTestDoctor,
  deleteTestClinics,
  deleteTestDoctor,
  loginDoctorUi,
  openPrimaryClinicForBookings,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

/**
 * D4 (user, 2026-09-30): clinics are curated by DocCy. In settings (redesign B1) a
 * clinic's address is read-only and changes, additions and removals go through
 * requests (docs/handoff/settings-redesign.md):
 * - no address field;
 * - only the professional's clinic links are shown and saved (`doctor_locations`, with
 *   its addressless "clinics being set up", was dropped in D4 step 2); a location id that
 *   is not one of their links is ignored;
 * - saving settings still saves each clinic's hours and name on its join row, and never
 *   changes an address, on the clinic or on the professional;
 * - the old `/api/doctor-locations` route is gone.
 */
test.describe("Integration: clinics are read-only in settings", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ retries: 0, timeout: 120_000 });

  let admin: SupabaseClient;
  const nonce = `ro${Date.now()}`.slice(-12);
  let doctor: TestDoctorFixture | null = null;
  let clinicId = "";
  let locationId = "";
  let clinicAddress = "";
  // Not one of the professional's clinic links (an old page, or a forged request).
  const unknownLocationId = randomUUID();

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    doctor = await createTestDoctor({
      admin,
      nonce,
      name: `Read Only Clinics ${nonce}`,
      specialty: "Cardiologist",
    });
    const opened = await openPrimaryClinicForBookings(admin, doctor.doctorId, nonce);
    clinicId = opened.clinicId;
    locationId = opened.locationId;

    const clinic = await admin.from("clinics").select("address").eq("id", clinicId).single();
    if (clinic.error) throw new Error(`clinic: ${clinic.error.message}`);
    clinicAddress = String(clinic.data.address);
  });

  test.afterAll(async () => {
    if (doctor) await deleteTestDoctor(doctor);
    await deleteTestClinics(admin, [clinicId]);
  });

  test("the settings page shows the clinic read-only", async ({ page }) => {
    await loginDoctorUi(page, doctor!.email, doctor!.password);
    await page.goto("/settings?section=clinics", { waitUntil: "domcontentloaded" });

    // Settings redesign (B1): one card per clinic, the address read-only with
    // "Request a change" (clinic changes go by request to DocCy).
    const cards = page.getByTestId("settings-clinic-card");
    // One clinic link: one card.
    await expect(cards).toHaveCount(1, { timeout: 20_000 });
    await expect(cards.first()).toContainText(clinicAddress);
    await expect(cards.first().getByRole("button", { name: "Request a change" })).toBeVisible();

    // Hours only: the name is DocCy's too, changed by request (user, 2026-10-01).
    // A click before hydration does nothing: retry until the editor opens.
    await expect(async () => {
      await cards.first().getByRole("button", { name: "Edit hours" }).click();
      await expect(page.getByTestId("settings-clinic-name-note")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page.locator("#clinicName")).toHaveCount(0);
    await expect(page.locator("#clinicAddress")).toHaveCount(0);
    // The last clinic cannot be removed.
    await expect(cards.first().getByRole("button", { name: "Remove clinic" })).toHaveCount(0);
  });

  test("saving settings keeps the address and saves the hours", async ({ page }) => {
    await loginDoctorUi(page, doctor!.email, doctor!.password);
    const res = await page.request.post("/api/doctor-settings", {
      data: {
        doctorId: doctor!.doctorId,
        doctorPhone: null,
        languages: ["English"],
        bio: "",
        bookingHorizonDays: 30,
        minimumNoticeHours: 0,
        holidayModeEnabled: false,
        // An old page could still send an address: it must be ignored.
        district: "Limassol",
        clinicAddress: "Somewhere Else 1, Limassol, Cyprus",
        clinicLatitude: 34.68,
        clinicLongitude: 33.04,
        clinicPlaceId: `other-${nonce}`,
        locations: [
          {
            id: locationId,
            label: "Afternoons",
            district: "Limassol",
            clinicAddress: "Somewhere Else 1, Limassol, Cyprus",
            clinicLatitude: 34.68,
            clinicLongitude: 33.04,
            clinicPlaceId: `other-${nonce}`,
            weeklySchedule: {
              monday: { enabled: true, start_time: "14:00", end_time: "18:00" },
              tuesday: { enabled: false, start_time: "09:00", end_time: "17:00" },
              wednesday: { enabled: false, start_time: "09:00", end_time: "17:00" },
              thursday: { enabled: false, start_time: "09:00", end_time: "17:00" },
              friday: { enabled: false, start_time: "09:00", end_time: "17:00" },
              saturday: { enabled: false, start_time: "09:00", end_time: "17:00" },
              sunday: { enabled: false, start_time: "09:00", end_time: "17:00" },
            },
            slotDurationMinutes: 50,
          },
          { id: unknownLocationId, slotDurationMinutes: 10 },
        ],
      },
      timeout: 30_000,
    });
    expect(res.status(), await res.text()).toBe(200);

    const join = await admin
      .from("professional_clinics")
      .select("slot_duration_minutes, label, monday, clinic_id")
      .eq("id", locationId)
      .single();
    if (join.error) throw new Error(`join: ${join.error.message}`);
    expect(join.data).toMatchObject({
      slot_duration_minutes: 50,
      label: "Afternoons",
      monday: true,
      clinic_id: clinicId,
    });

    const clinic = await admin.from("clinics").select("address, district").eq("id", clinicId).single();
    if (clinic.error) throw new Error(`clinic: ${clinic.error.message}`);
    expect(clinic.data).toEqual({ address: clinicAddress, district: "Nicosia" });

    // The unknown location id is ignored: it creates nothing.
    const unknown = await admin
      .from("professional_clinics")
      .select("id", { count: "exact", head: true })
      .eq("id", unknownLocationId);
    expect(unknown.error).toBeNull();
    expect(unknown.count).toBe(0);
  });

  test("a save with no address at all is accepted", async ({ page }) => {
    await loginDoctorUi(page, doctor!.email, doctor!.password);
    const res = await page.request.post("/api/doctor-settings", {
      data: {
        doctorId: doctor!.doctorId,
        languages: ["English"],
        locations: [{ id: locationId, slotDurationMinutes: 40 }],
      },
      timeout: 30_000,
    });
    expect(res.status(), await res.text()).toBe(200);
    const join = await admin
      .from("professional_clinics")
      .select("slot_duration_minutes")
      .eq("id", locationId)
      .single();
    expect(join.data?.slot_duration_minutes).toBe(40);
  });

  // An open day ends after it starts, and so does the break (user, 2026-10-10): the
  // form refuses it, and so does the route. Nothing of the save is kept.
  test("a save with a day or a break that ends before it starts is refused", async ({ page }) => {
    await loginDoctorUi(page, doctor!.email, doctor!.password);
    const hours = async () =>
      (
        await admin
          .from("professional_clinics")
          .select("weekly_schedule, break_start, break_end, slot_duration_minutes")
          .eq("id", locationId)
          .single()
      ).data;
    const before = await hours();
    const day = (enabled: boolean, start_time = "09:00", end_time = "17:00") => ({ enabled, start_time, end_time });
    const week = {
      monday: day(true),
      tuesday: day(true),
      wednesday: day(true),
      thursday: day(true),
      friday: day(true),
      saturday: day(false),
      sunday: day(false),
    };
    const post = (location: Record<string, unknown>) =>
      page.request.post("/api/doctor-settings", {
        data: {
          doctorId: doctor!.doctorId,
          languages: ["English"],
          bio: "Must not be saved either",
          locations: [{ id: locationId, slotDurationMinutes: 20, ...location }],
        },
        timeout: 30_000,
      });

    const wrongDay = await post({ weeklySchedule: { ...week, tuesday: day(true, "14:00", "09:00") } });
    expect(wrongDay.status(), await wrongDay.text()).toBe(400);
    expect((await wrongDay.json()).message).toBe("Tuesday must end after 14:00.");

    const wrongBreak = await post({ weeklySchedule: week, breakEnabled: true, breakStart: "14:00", breakEnd: "13:00" });
    expect(wrongBreak.status(), await wrongBreak.text()).toBe(400);
    expect((await wrongBreak.json()).message).toBe("The break must end after 14:00.");

    // Times go by quarter hours (user, 2026-10-10).
    const oddMinutes = await post({ weeklySchedule: { ...week, monday: day(true, "09:00", "17:02") } });
    expect(oddMinutes.status(), await oddMinutes.text()).toBe(400);
    expect((await oddMinutes.json()).message).toBe(
      "Monday must start and end on a quarter hour (:00, :15, :30 or :45).",
    );

    expect(await hours()).toEqual(before);
    const pro = await admin.from("professionals").select("bio").eq("id", doctor!.doctorId).single();
    expect(pro.data?.bio ?? "").not.toBe("Must not be saved either");

    // A day's own break sits inside that day's hours (user, 2026-10-10).
    const withBreak = (start: string, end: string, break_start: string | null, break_end: string | null) => ({
      ...day(true, start, end),
      break_start,
      break_end,
    });
    const breakOutside = await post({ weeklySchedule: { ...week, friday: withBreak("09:00", "13:00", "13:00", "14:00") } });
    expect(breakOutside.status(), await breakOutside.text()).toBe(400);
    expect((await breakOutside.json()).message).toBe("Friday's break must be within its hours (09:00 – 13:00).");
    expect(await hours()).toEqual(before);

    // A closed day's times do not matter.
    const closedDay = await post({ weeklySchedule: { ...week, saturday: day(false, "17:00", "09:00") } });
    expect(closedDay.status(), await closedDay.text()).toBe(200);

    // Each day keeps its own break; the clinic's one break is cleared.
    const perDay = await post({
      weeklySchedule: {
        ...week,
        monday: withBreak("09:00", "17:00", "13:00", "14:00"),
        friday: withBreak("09:00", "13:00", null, null),
      },
    });
    expect(perDay.status(), await perDay.text()).toBe(200);
    const saved = await hours();
    expect(saved?.weekly_schedule?.monday).toMatchObject({ break_start: "13:00:00", break_end: "14:00:00" });
    expect(saved?.weekly_schedule?.friday).toMatchObject({ break_start: null, break_end: null });
    expect(saved?.weekly_schedule?.tuesday).toMatchObject({ break_start: null, break_end: null });
    expect(saved).toMatchObject({ break_start: null, break_end: null });
  });

  test("the old clinic route is gone", async ({ page }) => {
    await loginDoctorUi(page, doctor!.email, doctor!.password);
    const res = await page.request.post("/api/doctor-locations", {
      data: { doctorId: doctor!.doctorId },
      timeout: 30_000,
    });
    expect(res.status()).toBe(404);
  });
});
