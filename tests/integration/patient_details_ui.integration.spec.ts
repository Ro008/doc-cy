import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";

import { patientAgeYears } from "@/lib/patient-details";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  createTestDoctor,
  deleteTestClinics,
  deleteTestDoctor,
  loginDoctorUi,
  openPrimaryClinicForBookings,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

/** A weekday at least 3 days ahead, at the given Cyprus hour, as UTC ISO. */
function weekdayAt(hour: number): string {
  let day = addDays(utcToZonedTime(new Date(), "Europe/Nicosia"), 3);
  while (day.getDay() === 0 || day.getDay() === 6) day = addDays(day, 1);
  return zonedTimeToUtc(`${format(day, "yyyy-MM-dd")}T${String(hour).padStart(2, "0")}:00`, "Europe/Nicosia").toISOString();
}

/**
 * The professional sees who the patient is (user, 2026-10-06): age, gender, first visit
 * or not, phone (tap to call) and email (tap to write), on the agenda's visit dialog and
 * on the request page. Missing values (manual booking without email) are left out.
 */
test.describe("Integration: patient details for the professional", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  let clinicId = "";
  let page: Page;
  const nonce = `pdu${Date.now()}`.slice(-12);
  const age = patientAgeYears("1990-05-17");

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Patient Details ${nonce}`, specialty: "Cardiology" });
    clinicId = (await openPrimaryClinicForBookings(admin, pro.doctorId, nonce)).clinicId;
    page = await browser.newPage();
    await loginDoctorUi(page, pro.email, pro.password);
  });

  test.afterAll(async () => {
    await page?.close();
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, [clinicId]);
  });

  async function visit(tag: string, hour: number, patch: Record<string, unknown>) {
    const visitIso = weekdayAt(hour);
    const { data, error } = await admin
      .from("appointments")
      .insert({
        professional_id: pro!.doctorId,
        clinic_id: clinicId,
        booking_source: "online",
        patient_name: `Details ${tag} ${nonce}`,
        patient_email: `details-${tag}-${nonce}@integration.test`,
        patient_phone: "+35799444555",
        patient_gender: "female",
        patient_birthdate: "1990-05-17",
        is_new_patient: true,
        reason: "Integration: patient details",
        appointment_datetime: visitIso,
        duration_minutes: 30,
        status: "CONFIRMED",
        ...patch,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`seed visit: ${error?.message}`);
    return { id: String(data.id), visitIso };
  }

  async function openOnAgenda(name: string, visitIso: string) {
    const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Nicosia" }).format(new Date(visitIso));
    await page.goto(`/agenda?date=${dateKey}&view=day`, { waitUntil: "domcontentloaded" });
    const block = page.locator("button:visible", { hasText: name }).first();
    await expect(block).toBeVisible({ timeout: 20_000 });
    const dialog = page.getByTestId("agenda-visit-patient");
    await expect(async () => {
      await block.click();
      await expect(dialog).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    return dialog;
  }

  test("the agenda dialog shows age, gender, first visit, phone and email", async () => {
    const { visitIso } = await visit("a", 10, {});
    const dialog = await openOnAgenda(`Details a ${nonce}`, visitIso);
    await expect(dialog.getByTestId("patient-summary")).toHaveText(`${age} years · Female · First visit`);
    await expect(dialog.getByText("born 17 May 1990")).toBeVisible();
    await expect(dialog.getByRole("link", { name: "+35799444555" })).toHaveAttribute("href", "tel:+35799444555");
    await expect(dialog.getByRole("link", { name: `details-a-${nonce}@integration.test` })).toHaveAttribute(
      "href",
      `mailto:details-a-${nonce}@integration.test`,
    );
    // Cancel stays available and reads as an action (red, user 2026-10-06).
    await expect(page.getByRole("button", { name: /^Cancel appointment$/i })).toHaveClass(/text-red-/);
  });

  test("a manual booking without email leaves the email out; returning patient", async () => {
    const { visitIso } = await visit("b", 11, {
      booking_source: "manual",
      patient_email: null,
      patient_gender: "prefer_not_to_say",
      is_new_patient: false,
    });
    const dialog = await openOnAgenda(`Details b ${nonce}`, visitIso);
    await expect(dialog.getByTestId("patient-summary")).toHaveText(`${age} years · Returning patient`);
    await expect(dialog.getByRole("link", { name: "+35799444555" })).toBeVisible();
    await expect(dialog.locator('a[href^="mailto:"]')).toHaveCount(0);
  });

  test("the request page shows the same details", async () => {
    const { id } = await visit("c", 12, { status: "REQUESTED", patient_gender: "male" });
    await page.goto(`/dashboard/appointments/${id}`, { waitUntil: "domcontentloaded" });
    const details = page.getByTestId("review-patient");
    await expect(details.getByTestId("patient-summary")).toHaveText(`${age} years · Male · First visit`, {
      timeout: 20_000,
    });
    await expect(details.getByRole("link", { name: "+35799444555" })).toHaveAttribute("href", "tel:+35799444555");
    await expect(details.getByRole("link", { name: `details-c-${nonce}@integration.test` })).toBeVisible();
  });
});
