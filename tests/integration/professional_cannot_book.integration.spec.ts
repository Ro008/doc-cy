import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";

import { createAppointmentDraft } from "@/lib/appointment-drafts";
import { issueAppointmentLink } from "@/lib/appointment-links-db";

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

  test("a signed-in professional opening the emailed confirm link can't confirm", async () => {
    const { token, draftId } = await createAppointmentDraft(admin, {
      professionalId: colleague!.doctorId,
      clinicId: clinicIds[1],
      appointmentUtc: zonedTimeToUtc(weekdayLocal(12), CY),
      durationMinutes: 30,
      patientName: `Link Patient ${nonce}`,
      patientEmail: `link-patient-${nonce}@integration.test`,
      patientPhone: "+35799222333",
      isNewPatient: false,
      reason: "Integration: confirm link while signed in",
      patientGender: "male",
      patientBirthdate: "1980-01-01",
    });

    await page.goto(`/booking/confirm?token=${token}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("booking-confirm-professional")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Confirm my request/i })).toHaveCount(0);

    const res = await page.request.post("/api/booking/confirm", { data: { token } });
    expect(res.status(), await res.text()).toBe(403);
    expect((await res.json()).code).toBe("professional_signed_in");

    // The link was not used up: the patient can still confirm it signed out.
    const { data: draft } = await admin.from("appointment_drafts").select("confirmed_at").eq("id", draftId).single();
    expect(draft?.confirmed_at).toBeNull();
  });

  const patientVisit = (extra: Record<string, unknown>) => ({
    professional_id: colleague!.doctorId,
    clinic_id: clinicIds[1],
    booking_source: "online",
    patient_name: `Visit Patient ${nonce}`,
    patient_email: `visit-patient-${nonce}@integration.test`,
    patient_phone: "+35799666777",
    patient_gender: "female",
    patient_birthdate: "1992-02-02",
    is_new_patient: true,
    duration_minutes: 30,
    status: "CONFIRMED",
    ...extra,
  });

  test("a signed-in professional opening a cancel link can't cancel the visit", async () => {
    const day = 24 * 3_600_000;
    const visit = new Date(Date.now() + 10 * day);
    const { data, error } = await admin
      .from("appointments")
      .insert(patientVisit({ reason: "Integration: cancel link while signed in", appointment_datetime: visit.toISOString() }))
      .select("id")
      .single();
    if (error || !data) throw new Error(`seed: ${error?.message}`);
    const token = await issueAppointmentLink(admin, { appointmentId: String(data.id), purpose: "cancel", expiresAt: visit });

    await page.goto(`/booking/cancel?token=${encodeURIComponent(token)}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("patient-cancel-professional")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Cancel appointment/i })).toHaveCount(0);

    const res = await page.request.post("/api/booking/cancel", { data: { token } });
    expect(res.status(), await res.text()).toBe(403);
    expect((await res.json()).code).toBe("professional_signed_in");

    // Nothing changed, and the link is not used up: the patient can still cancel it signed out.
    const { data: after } = await admin.from("appointments").select("status").eq("id", data.id).single();
    expect(after?.status).toBe("CONFIRMED");
    const { data: links } = await admin.from("appointment_links").select("used_at").eq("appointment_id", data.id);
    expect((links ?? []).every((l) => l.used_at === null)).toBe(true);
  });

  test("a signed-in professional opening a review link can't leave a review", async () => {
    const day = 24 * 3_600_000;
    const { data, error } = await admin
      .from("appointments")
      .insert(
        patientVisit({
          reason: "Integration: review link while signed in",
          appointment_datetime: new Date(Date.now() - 2 * day).toISOString(),
          attendance: "attended",
          review_requested_at: new Date().toISOString(),
        }),
      )
      .select("id")
      .single();
    if (error || !data) throw new Error(`seed: ${error?.message}`);
    const token = await issueAppointmentLink(admin, {
      appointmentId: String(data.id),
      purpose: "review",
      expiresAt: new Date(Date.now() + 30 * day),
    });

    await page.goto(`/booking/review?token=${encodeURIComponent(token)}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("review-professional")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Publish review/i })).toHaveCount(0);

    const res = await page.request.post("/api/booking/review", {
      data: { token, rating: 5, comment: "Great", email: `visit-patient-${nonce}@integration.test` },
    });
    expect(res.status(), await res.text()).toBe(403);
    expect((await res.json()).code).toBe("professional_signed_in");

    const { count } = await admin
      .from("professional_reviews")
      .select("id", { count: "exact", head: true })
      .eq("appointment_id", data.id);
    expect(count).toBe(0);
  });

  test("a signed-in professional opening a proposal link can't choose or decline times", async () => {
    const hour = 3_600_000;
    const base = Math.ceil((Date.now() + 9 * 24 * hour) / hour) * hour;
    const slots = [new Date(base + 2 * hour).toISOString(), new Date(base + 4 * hour).toISOString()];
    const expiresAt = new Date(Date.now() + 20 * hour);
    const { data, error } = await admin
      .from("appointments")
      .insert({
        professional_id: colleague!.doctorId,
        clinic_id: clinicIds[1],
        booking_source: "online",
        patient_name: `Proposal Patient ${nonce}`,
        patient_email: `proposal-patient-${nonce}@integration.test`,
        patient_phone: "+35799444555",
        patient_gender: "female",
        patient_birthdate: "1995-05-05",
        is_new_patient: true,
        reason: "Integration: proposal link while signed in",
        appointment_datetime: new Date(base).toISOString(),
        duration_minutes: 30,
        status: "NEEDS_RESCHEDULE",
        proposed_slots: slots,
        proposal_expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`seed: ${error?.message}`);
    const token = await issueAppointmentLink(admin, { appointmentId: String(data.id), purpose: "proposal", expiresAt });

    await page.goto(`/booking/choose?token=${encodeURIComponent(token)}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("choose-professional")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Confirm|Decline/i })).toHaveCount(0);

    for (const [path, payload] of [
      ["/api/booking/choose", { token, slot: slots[0] }],
      ["/api/booking/decline-proposal", { token, message: "No" }],
    ] as const) {
      const res = await page.request.post(path, { data: payload });
      expect(res.status(), await res.text()).toBe(403);
      expect((await res.json()).code).toBe("professional_signed_in");
    }

    // Nothing changed: still waiting for the patient.
    const { data: after } = await admin.from("appointments").select("status").eq("id", data.id).single();
    expect(after?.status).toBe("NEEDS_RESCHEDULE");
  });
});
