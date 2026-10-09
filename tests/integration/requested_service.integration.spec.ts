import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";

import { createAppointmentDraft } from "@/lib/appointment-drafts";
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
 * The requested service (user, 2026-10-04): a booking may name one of the professional's
 * own services (optional). The visit keeps the id and a copy of the name taken at booking,
 * so renaming or deleting the service later doesn't change what was asked. The picker UI
 * lives on another branch; these tests drive the API.
 */

const CY = "Europe/Nicosia";

function weekdayLocal(hour: number, daysAhead = 3): string {
  let day = addDays(utcToZonedTime(new Date(), CY), daysAhead);
  while (day.getDay() === 0 || day.getDay() === 6) day = addDays(day, 1);
  return `${format(day, "yyyy-MM-dd")}T${String(hour).padStart(2, "0")}:00`;
}

function patient(tag: string, patch: Record<string, unknown> = {}) {
  return {
    patientName: `Service Patient ${tag}`,
    patientEmail: `service-${tag}@integration.test`,
    patientPhone: "+35799777888",
    isNewPatient: true,
    reason: "Integration: requested service",
    patientGender: "female",
    patientBirthdate: "1988-08-08",
    ...patch,
  };
}

test.describe("Integration: requested service", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  let clinicId = "";
  let linkId = "";
  let serviceId = "";
  let page: Page;
  const nonce = `svc${Date.now()}`.slice(-12);

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Service ${nonce}`, specialty: "Cardiology" });
    const seeded = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicId = seeded.clinicId;
    linkId = seeded.locationId;
    const { data, error } = await admin
      .from("professional_services")
      .insert({ professional_id: pro.doctorId, name: "Heart check-up", price: "€60" })
      .select("id")
      .single();
    if (error || !data) throw new Error(`service seed: ${error?.message}`);
    serviceId = String(data.id);
    page = await browser.newPage();
    await loginDoctorUi(page, pro.email, pro.password);
  });

  test.afterAll(async () => {
    await page?.close();
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, [clinicId]);
  });

  test("the online form stores the chosen service on the draft", async ({ request }) => {
    const p = patient(`${nonce}a`);
    const res = await request.post("/api/appointments", {
      data: { doctorId: pro!.doctorId, locationId: linkId, appointmentLocal: weekdayLocal(10), professionalServiceId: serviceId, ...p },
    });
    expect(res.status(), await res.text()).toBe(202);
    const { data } = await admin
      .from("appointment_drafts")
      .select("professional_service_id, service_name")
      .eq("patient_email", p.patientEmail)
      .single();
    expect(data).toEqual({ professional_service_id: serviceId, service_name: "Heart check-up" });
  });

  test("no service is fine", async ({ request }) => {
    const p = patient(`${nonce}b`);
    const res = await request.post("/api/appointments", {
      data: { doctorId: pro!.doctorId, locationId: linkId, appointmentLocal: weekdayLocal(11), ...p },
    });
    expect(res.status(), await res.text()).toBe(202);
    const { data } = await admin
      .from("appointment_drafts")
      .select("professional_service_id, service_name")
      .eq("patient_email", p.patientEmail)
      .single();
    expect(data).toEqual({ professional_service_id: null, service_name: null });
  });

  test("refuses a service that isn't hers, or isn't a service at all", async ({ request }) => {
    for (const [tag, professionalServiceId] of [
      ["c", "00000000-0000-4000-8000-000000000000"],
      ["d", "not-a-service"],
    ]) {
      const p = patient(`${nonce}${tag}`);
      const res = await request.post("/api/appointments", {
        data: { doctorId: pro!.doctorId, locationId: linkId, appointmentLocal: weekdayLocal(12), professionalServiceId, ...p },
      });
      expect(res.status()).toBe(400);
      const { count } = await admin
        .from("appointment_drafts")
        .select("id", { count: "exact", head: true })
        .eq("patient_email", p.patientEmail);
      expect(count).toBe(0);
    }
  });

  test("confirming the link carries the service to the request", async ({ request }) => {
    const email = `service-${nonce}e@integration.test`;
    const { token } = await createAppointmentDraft(admin, {
      professionalId: pro!.doctorId,
      clinicId,
      appointmentUtc: zonedTimeToUtc(weekdayLocal(13), CY),
      durationMinutes: 30,
      patientName: `Service Draft ${nonce}`,
      patientEmail: email,
      patientPhone: "+35799777999",
      isNewPatient: false,
      reason: "Integration: requested service",
      patientGender: "male",
      patientBirthdate: "1979-09-09",
      professionalServiceId: serviceId,
    });
    const res = await request.post("/api/booking/confirm", { data: { token } });
    expect(res.status(), await res.text()).toBe(200);
    const id = String((await res.json()).appointment.id);
    const { data } = await admin
      .from("appointments")
      .select("professional_service_id, service_name")
      .eq("id", id)
      .single();
    expect(data).toEqual({ professional_service_id: serviceId, service_name: "Heart check-up" });
  });

  test("a manual booking can name a service too; deleting the service keeps the name", async () => {
    const res = await page.request.post("/api/appointments/manual", {
      data: {
        locationId: linkId,
        appointmentLocal: weekdayLocal(14),
        professionalServiceId: serviceId,
        ...patient(`${nonce}f`, { patientEmail: "" }),
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const id = String((await res.json()).appointment.id);
    const read = async () =>
      (await admin.from("appointments").select("professional_service_id, service_name").eq("id", id).single()).data;
    expect(await read()).toEqual({ professional_service_id: serviceId, service_name: "Heart check-up" });

    await admin.from("professional_services").delete().eq("id", serviceId);
    expect(await read()).toEqual({ professional_service_id: null, service_name: "Heart check-up" });
  });

  test("a manual booking refuses another professional's service", async () => {
    const res = await page.request.post("/api/appointments/manual", {
      data: {
        locationId: linkId,
        appointmentLocal: weekdayLocal(15),
        professionalServiceId: "00000000-0000-4000-8000-000000000000",
        ...patient(`${nonce}g`, { patientEmail: "" }),
      },
    });
    expect(res.status()).toBe(400);
  });
});
