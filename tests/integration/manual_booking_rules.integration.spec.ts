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
 * Manual booking (user, 2026-10-02/04):
 * - Name, phone, first visit, reason, gender and birth date required; email optional.
 * - Allowed at a paused clinic (phone / walk-in); refused once pro access has ended.
 * - Stored as booking_source manual with clinic_id; the professional gets no email
 *   about her own booking.
 */

const CY = "Europe/Nicosia";

function weekdayLocal(hour: number, daysAhead = 3): string {
  let day = addDays(utcToZonedTime(new Date(), CY), daysAhead);
  while (day.getDay() === 0 || day.getDay() === 6) day = addDays(day, 1);
  return `${format(day, "yyyy-MM-dd")}T${String(hour).padStart(2, "0")}:00`;
}

function manual(nonce: string, patch: Record<string, unknown> = {}) {
  return {
    patientName: `Manual Patient ${nonce}`,
    patientPhone: "+35799555666",
    patientEmail: "",
    isNewPatient: false,
    reason: "Integration: manual booking",
    patientGender: "male",
    patientBirthdate: "1975-03-04",
    ...patch,
  };
}

test.describe("Integration: manual booking rules", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  let clinicId = "";
  let linkId = "";
  let page: Page;
  const nonce = `mbr${Date.now()}`.slice(-12);

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Manual Rules ${nonce}`, specialty: "Cardiology" });
    const seeded = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicId = seeded.clinicId;
    linkId = seeded.locationId;
    page = await browser.newPage();
    await loginDoctorUi(page, pro.email, pro.password);
  });

  test.afterAll(async () => {
    await page?.close();
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, [clinicId]);
  });

  const post = (data: Record<string, unknown>) =>
    page.request.post("/api/appointments/manual", { data: { locationId: linkId, ...data } });

  test("books without an email, as a confirmed manual visit at the clinic", async () => {
    const res = await post({ appointmentLocal: weekdayLocal(10), ...manual(`${nonce}a`) });
    expect(res.status(), await res.text()).toBe(201);
    const id = String((await res.json()).appointment.id);
    const { data } = await admin
      .from("appointments")
      .select("status, booking_source, clinic_id, patient_email, patient_gender, patient_birthdate, is_new_patient")
      .eq("id", id)
      .single();
    expect(data).toMatchObject({
      status: "CONFIRMED",
      booking_source: "manual",
      clinic_id: clinicId,
      patient_email: null,
      patient_gender: "male",
      patient_birthdate: "1975-03-04",
      is_new_patient: false,
    });
  });

  // Only name, phone and reason are required for a manual booking (Rocío, 2026-10-06).
  test("needs the phone", async () => {
    const res = await post({ appointmentLocal: weekdayLocal(11), ...manual(`${nonce}b`, { patientPhone: "" }) });
    expect(res.status()).toBe(400);
    expect(String((await res.json()).message).toLowerCase()).toContain("phone");
  });

  test("gender, birth date and first visit are optional", async () => {
    const res = await post({
      appointmentLocal: weekdayLocal(14),
      ...manual(`${nonce}f`, { patientGender: "", patientBirthdate: "", isNewPatient: null }),
    });
    expect(res.status(), await res.text()).toBe(201);
  });

  test("works at a paused clinic", async () => {
    await admin.from("professional_clinics").update({ pause_online_bookings: true }).eq("id", linkId);
    try {
      const res = await post({ appointmentLocal: weekdayLocal(12), ...manual(`${nonce}c`) });
      expect(res.status(), await res.text()).toBe(201);
    } finally {
      await admin.from("professional_clinics").update({ pause_online_bookings: false }).eq("id", linkId);
    }
  });

  test("is refused once pro access has ended", async () => {
    const until = new Date(Date.now() + 180 * 86_400_000).toISOString();
    await admin
      .from("professionals")
      .update({ pro_access_until: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", pro!.doctorId);
    try {
      const res = await post({ appointmentLocal: weekdayLocal(13), ...manual(`${nonce}d`) });
      expect(res.status()).toBe(403);
      expect((await res.json()).code).toBe("access_expired");
    } finally {
      await admin.from("professionals").update({ pro_access_until: until }).eq("id", pro!.doctorId);
    }
  });
});
