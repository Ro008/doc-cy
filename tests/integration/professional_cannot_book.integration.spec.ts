import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";

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
 * A signed-in professional can't book, with anyone, herself included (user, 2026-10-06).
 * The public site stays viewable: on her own profile she's pointed to manual booking,
 * on a colleague's she's told to sign out to book as a patient. The booking API refuses
 * too, not just the page.
 */

const CY = "Europe/Nicosia";

function weekdayLocal(hour: number, daysAhead = 3): string {
  let day = addDays(utcToZonedTime(new Date(), CY), daysAhead);
  while (day.getDay() === 0 || day.getDay() === 6) day = addDays(day, 1);
  return `${format(day, "yyyy-MM-dd")}T${String(hour).padStart(2, "0")}:00`;
}

test.describe("Integration: a signed-in professional can't book", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let me: TestDoctorFixture | null = null;
  let colleague: TestDoctorFixture | null = null;
  const clinicIds: string[] = [];
  const linkIds: Record<string, string> = {};
  let page: Page;
  const nonce = `pcb${Date.now()}`.slice(-12);

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    me = await createTestDoctor({ admin, nonce: `${nonce}m`, name: `Booking Me ${nonce}`, specialty: "Cardiology" });
    colleague = await createTestDoctor({
      admin,
      nonce: `${nonce}c`,
      name: `Booking Colleague ${nonce}`,
      specialty: "Cardiology",
    });
    for (const pro of [me, colleague]) {
      const seeded = await openPrimaryClinicForBookings(admin, pro.doctorId, `${nonce}${pro === me ? "m" : "c"}`);
      clinicIds.push(seeded.clinicId);
      linkIds[pro.doctorId] = seeded.locationId;
    }
    page = await browser.newPage();
    await loginDoctorUi(page, me.email, me.password);
  });

  test.afterAll(async () => {
    await page?.close();
    if (me) await deleteTestDoctor(me);
    if (colleague) await deleteTestDoctor(colleague);
    await deleteTestClinics(admin, clinicIds);
  });

  const form = (pro: TestDoctorFixture, hour: number) => ({
    doctorId: pro.doctorId,
    locationId: linkIds[pro.doctorId],
    appointmentLocal: weekdayLocal(hour),
    patientName: `Pro As Patient ${nonce}`,
    patientEmail: `pro-as-patient-${nonce}@integration.test`,
    patientPhone: "+35799111000",
    isNewPatient: true,
    reason: "Integration: professional tries to book",
    patientGender: "female",
    patientBirthdate: "1985-03-03",
  });

  test("the booking API refuses a signed-in professional, with a colleague or herself", async () => {
    for (const pro of [colleague!, me!]) {
      const res = await page.request.post("/api/appointments", { data: form(pro, 10) });
      expect(res.status(), await res.text()).toBe(403);
      expect((await res.json()).code).toBe("professional_signed_in");
    }
    const { count } = await admin
      .from("appointment_drafts")
      .select("id", { count: "exact", head: true })
      .eq("patient_email", `pro-as-patient-${nonce}@integration.test`);
    expect(count).toBe(0);
  });

  test("signed out, the same form is accepted", async ({ request }) => {
    const res = await request.post("/api/appointments", { data: form(colleague!, 11) });
    expect(res.status(), await res.text()).toBe(202);
  });

  test("her own profile points her to manual booking instead of the calendar", async () => {
    await page.goto(`/${me!.slug}`, { waitUntil: "domcontentloaded" });
    const note = page.getByTestId("booking-own-profile-notice");
    await expect(note).toBeVisible({ timeout: 20_000 });
    await expect(note.getByRole("link")).toHaveAttribute("href", "/agenda?manual=1");
    await expect(page.getByTestId("booking-section")).toHaveCount(0);
  });

  test("a colleague's profile tells her to sign out to book as a patient", async () => {
    await page.goto(`/${colleague!.slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("booking-professional-notice")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("booking-section")).toHaveCount(0);
  });
});
