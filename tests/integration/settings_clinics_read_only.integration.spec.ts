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
 * D4 (user, 2026-09-30): the settings page shows the professional's clinics read-only
 * ("Contact us to change your clinics") until Ro008's clinic join/leave/create/edit
 * screens and their requests exist. Clinics are curated by DocCy:
 * - no Add clinic, no Remove this clinic, no address field;
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
    await page.goto("/agenda/settings", { waitUntil: "domcontentloaded" });

    const frame = page.getByTestId("workplace-settings-frame");
    await expect(frame).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("settings-clinic-address")).toHaveText(clinicAddress, {
      timeout: 20_000,
    });
    await expect(page.getByTestId("settings-clinics-contact")).toHaveText(
      /Contact us to change your clinics/i,
    );
    // Point E3: specialties are read-only too, until the new specialty requests.
    await expect(page.getByTestId("settings-specialties-contact")).toHaveText(
      /Contact us if you wish to change your specialties/i,
    );
    await expect(page.getByText(/Request a specialty update/i)).toHaveCount(0);

    await expect(page.locator("#clinicAddress")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Add clinic$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Remove this clinic/i })).toHaveCount(0);
    // One clinic, so no tabs.
    await expect(page.getByRole("tablist", { name: "Clinics" })).toHaveCount(0);
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

  test("the old clinic route is gone", async ({ page }) => {
    await loginDoctorUi(page, doctor!.email, doctor!.password);
    const res = await page.request.post("/api/doctor-locations", {
      data: { doctorId: doctor!.doctorId },
      timeout: 30_000,
    });
    expect(res.status()).toBe(404);
  });
});
