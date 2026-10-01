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
 * - a clinic still being set up (an addressless `doctor_locations` row) is no longer
 *   shown: nothing reads `doctor_locations` any more;
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
  let pendingLocationId = "";

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    doctor = await createTestDoctor({
      admin,
      nonce,
      name: `Read Only Clinics ${nonce}`,
      specialty: "Cardiologist",
      is_specialty_approved: true,
      status: "verified",
    });
    const opened = await openPrimaryClinicForBookings(admin, doctor.doctorId, nonce);
    clinicId = opened.clinicId;
    locationId = opened.locationId;

    const clinic = await admin.from("clinics").select("address").eq("id", clinicId).single();
    if (clinic.error) throw new Error(`clinic: ${clinic.error.message}`);
    clinicAddress = String(clinic.data.address);

    // What the old "Add clinic" created: no address, no district, so no join row.
    const pending = await admin
      .from("doctor_locations")
      .insert({ doctor_id: doctor.doctorId, is_primary: false, sort_order: 1 })
      .select("id")
      .single();
    if (pending.error || !pending.data) throw new Error(`pending: ${pending.error?.message}`);
    pendingLocationId = String(pending.data.id);
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
    // The addressless location is not a clinic: one card.
    await expect(cards).toHaveCount(1, { timeout: 20_000 });
    await expect(cards.first()).toContainText(clinicAddress);
    await expect(cards.first().getByRole("button", { name: "Request a change" })).toBeVisible();

    await cards.first().getByRole("button", { name: "Edit name and hours" }).click();
    await expect(page.locator("#clinicName")).toBeVisible();
    await expect(page.locator("#clinicAddress")).toHaveCount(0);
    // The last clinic cannot be removed.
    await expect(cards.first().getByRole("button", { name: "Remove clinic" })).toHaveCount(0);
  });

  test("saving settings keeps the address and saves the hours", async ({ page }) => {
    const before = await admin
      .from("professionals")
      .select("district, clinic_address, latitude, longitude, clinic_place_id")
      .eq("id", doctor!.doctorId)
      .single();
    if (before.error) throw new Error(`before: ${before.error.message}`);

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
          { id: pendingLocationId, slotDurationMinutes: 10 },
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

    const after = await admin
      .from("professionals")
      .select("district, clinic_address, latitude, longitude, clinic_place_id")
      .eq("id", doctor!.doctorId)
      .single();
    if (after.error) throw new Error(`after: ${after.error.message}`);
    expect(after.data).toEqual(before.data);

    // The addressless location is not a clinic and is never written.
    const pending = await admin
      .from("doctor_locations")
      .select("slot_duration_minutes")
      .eq("id", pendingLocationId)
      .single();
    if (pending.error) throw new Error(`pending: ${pending.error.message}`);
    expect(pending.data.slot_duration_minutes).not.toBe(10);
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
