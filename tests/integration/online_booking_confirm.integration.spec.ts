import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";

import { createAppointmentDraft } from "@/lib/appointment-drafts";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  createTestDoctor,
  deleteTestClinics,
  deleteTestDoctor,
  openPrimaryClinicForBookings,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

/**
 * Online booking with email confirmation (user, 2026-10-02):
 * - Submitting the form creates a draft and emails a 30-minute, single-use link; no
 *   appointment exists yet and the professional is not told.
 * - Confirming the link re-checks the time and creates the REQUESTED appointment
 *   (booking_source online, clinic_id).
 * The raw token only travels in the email, so confirm tests create their own draft.
 */

const CY = "Europe/Nicosia";

/** A weekday at least 3 days ahead, at the given Cyprus hour ("YYYY-MM-DDTHH:mm"). */
function weekdayLocal(hour: number, daysAhead = 3): string {
  let day = addDays(utcToZonedTime(new Date(), CY), daysAhead);
  while (day.getDay() === 0 || day.getDay() === 6) day = addDays(day, 1);
  return `${format(day, "yyyy-MM-dd")}T${String(hour).padStart(2, "0")}:00`;
}

function patient(nonce: string, patch: Record<string, unknown> = {}) {
  return {
    patientName: `Online Patient ${nonce}`,
    patientEmail: `online-${nonce}@integration.test`,
    patientPhone: "+35799111222",
    isNewPatient: true,
    reason: "Integration: email-confirmed booking",
    patientGender: "female",
    patientBirthdate: "1990-05-17",
    ...patch,
  };
}

test.describe("Integration: online booking confirmed by email", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  let clinicId = "";
  let linkId = "";
  const nonce = `obc${Date.now()}`.slice(-12);

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Online Confirm ${nonce}`, specialty: "Cardiology" });
    const seeded = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicId = seeded.clinicId;
    linkId = seeded.locationId;
  });

  test.afterAll(async () => {
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, [clinicId]);
  });

  async function draftFor(appointmentLocal: string, email: string, expiresInMinutes = 30) {
    const now = new Date(Date.now() + (expiresInMinutes - 30) * 60_000);
    return createAppointmentDraft(
      admin,
      {
        professionalId: pro!.doctorId,
        clinicId,
        appointmentUtc: zonedTimeToUtc(appointmentLocal, CY),
        durationMinutes: 30,
        patientName: `Draft Patient ${nonce}`,
        patientEmail: email,
        patientPhone: "+35799333444",
        isNewPatient: false,
        reason: "Integration: confirm",
        patientGender: "male",
        patientBirthdate: "1980-01-01",
      },
      now,
    );
  }

  test("submitting the form creates a draft, not an appointment", async ({ request }) => {
    const p = patient(`${nonce}a`);
    const res = await request.post("/api/appointments", {
      data: { doctorId: pro!.doctorId, locationId: linkId, appointmentLocal: weekdayLocal(10), ...p },
    });
    expect(res.status(), await res.text()).toBe(202);
    expect((await res.json()).status).toBe("check_email");

    const { data: drafts } = await admin
      .from("appointment_drafts")
      .select("id, clinic_id, patient_gender, confirmed_at")
      .eq("patient_email", p.patientEmail);
    expect(drafts).toHaveLength(1);
    expect(drafts![0].clinic_id).toBe(clinicId);
    expect(drafts![0].confirmed_at).toBeNull();

    const { count } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_email", p.patientEmail);
    expect(count).toBe(0);
  });

  test("the form needs gender and birth date", async ({ request }) => {
    const res = await request.post("/api/appointments", {
      data: {
        doctorId: pro!.doctorId,
        locationId: linkId,
        appointmentLocal: weekdayLocal(11),
        ...patient(`${nonce}b`, { patientGender: undefined }),
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toMatch(/gender/i);
  });

  test("confirming the link creates the request, once", async ({ request }) => {
    const email = `confirm-${nonce}@integration.test`;
    const { token } = await draftFor(weekdayLocal(12), email);

    const first = await request.post("/api/booking/confirm", { data: { token } });
    expect(first.status(), await first.text()).toBe(200);

    const { data: rows } = await admin
      .from("appointments")
      .select("id, status, booking_source, clinic_id, patient_gender, patient_birthdate, is_new_patient")
      .eq("patient_email", email);
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({
      status: "REQUESTED",
      booking_source: "online",
      clinic_id: clinicId,
      patient_gender: "male",
      patient_birthdate: "1980-01-01",
      is_new_patient: false,
    });

    const { data: draft } = await admin
      .from("appointment_drafts")
      .select("confirmed_at, appointment_id")
      .eq("patient_email", email)
      .single();
    expect(draft!.confirmed_at).not.toBeNull();
    expect(draft!.appointment_id).toBe(rows![0].id);

    const second = await request.post("/api/booking/confirm", { data: { token } });
    expect(second.status()).toBe(410);
    expect((await second.json()).state).toBe("used");
  });

  test("an expired link is refused", async ({ request }) => {
    const { token } = await draftFor(weekdayLocal(13), `expired-${nonce}@integration.test`, -1);
    const res = await request.post("/api/booking/confirm", { data: { token } });
    expect(res.status()).toBe(410);
    expect((await res.json()).state).toBe("expired");
  });

  test("an unknown link is refused", async ({ request }) => {
    const res = await request.post("/api/booking/confirm", { data: { token: "x".repeat(43) } });
    expect(res.status()).toBe(410);
    expect((await res.json()).state).toBe("invalid");
  });

  test("confirming a time someone took meanwhile says so", async ({ request }) => {
    const when = weekdayLocal(14);
    const { token: first } = await draftFor(when, `race-a-${nonce}@integration.test`);
    const { token: second } = await draftFor(when, `race-b-${nonce}@integration.test`);
    expect((await request.post("/api/booking/confirm", { data: { token: first } })).status()).toBe(200);
    const res = await request.post("/api/booking/confirm", { data: { token: second } });
    expect(res.status()).toBe(409);
    expect((await res.json()).code).toBe("slot_taken");
  });

  test("one open request per email per professional", async ({ request }) => {
    const email = `confirm-${nonce}@integration.test`; // has an open request from the test above
    const res = await request.post("/api/appointments", {
      data: {
        doctorId: pro!.doctorId,
        locationId: linkId,
        appointmentLocal: weekdayLocal(15),
        ...patient(`${nonce}c`, { patientEmail: email }),
      },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).code).toBe("open_request_exists");
  });

  test("the link page asks the patient to confirm, and says when it has expired", async ({ page }) => {
    const { token } = await draftFor(weekdayLocal(16), `page-${nonce}@integration.test`);
    await page.goto(`/booking/confirm?token=${encodeURIComponent(token)}`);
    await expect(page.getByRole("button", { name: /confirm my request/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /confirm my request/i }).click();
    await expect(page.getByRole("heading", { name: /request sent/i })).toBeVisible({ timeout: 20_000 });

    const { token: old } = await draftFor(weekdayLocal(16, 4), `page-old-${nonce}@integration.test`, -1);
    await page.goto(`/booking/confirm?token=${encodeURIComponent(old)}`);
    await expect(page.getByRole("heading", { name: /link has expired/i })).toBeVisible({ timeout: 20_000 });
  });
});
