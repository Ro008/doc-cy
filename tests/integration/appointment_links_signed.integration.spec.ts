import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { addDays, format, subDays } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";

import { CY_TZ } from "@/lib/appointments";
import {
  appointmentCalendarPath,
  appointmentRequestSentQuery,
} from "@/lib/appointment-links";
import {
  createTestDoctor,
  deleteTestDoctor,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

/**
 * Booking links (the calendar download and the request-sent page) used to open
 * for anyone holding the appointment id, and `?audience=doctor` turned the
 * patient's link into the professional's version with the patient's phone.
 * Links are now signed per audience and expire 7 days after the appointment.
 */

const PATIENT_PHONE = "99876543";

function cyIso(day: Date, time: string): string {
  const key = format(utcToZonedTime(day, CY_TZ), "yyyy-MM-dd");
  return zonedTimeToUtc(`${key}T${time}`, CY_TZ).toISOString();
}

test.describe("Signed appointment links", { tag: ["@pr-e2e", "@pr-e2e-booking"] }, () => {
  test.describe.configure({ mode: "serial" });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
  let fixture: TestDoctorFixture | null = null;
  let upcomingId = "";
  let pastId = "";
  let patientName = "";

  test.beforeAll(async () => {
    const nonce = `links${Date.now()}`.slice(-12);
    fixture = await createTestDoctor({
      admin,
      nonce,
      name: `Links Doctor ${nonce.slice(-4)}`,
      specialty: "Cardiology",
      is_specialty_approved: true,
      status: "verified",
    });
    patientName = `Links Patient ${nonce.slice(-5)}`;

    const insert = async (iso: string) => {
      const res = await admin
        .from("appointments")
        .insert({
          doctor_id: fixture!.doctorId,
          patient_name: patientName,
          patient_email: `links-${nonce}-${iso.slice(0, 10)}@integration.test`,
          patient_phone: PATIENT_PHONE,
          appointment_datetime: iso,
          status: "CONFIRMED",
          reason: "Signed links test",
        })
        .select("id")
        .single();
      expect(res.error).toBeNull();
      return String(res.data!.id);
    };
    upcomingId = await insert(cyIso(addDays(new Date(), 2), "10:00"));
    pastId = await insert(cyIso(subDays(new Date(), 8), "10:00"));
  });

  test.afterAll(async () => {
    if (!fixture) return;
    await admin.from("appointments").delete().eq("doctor_id", fixture.doctorId);
    await deleteTestDoctor(fixture);
  });

  test("calendar downloads need a signature for the right audience", async ({ request }) => {
    const unsigned = await request.get(`/api/appointments/${upcomingId}/calendar`);
    expect(unsigned.status()).toBe(403);

    const legacyDoctor = await request.get(
      `/api/appointments/${upcomingId}/calendar?audience=doctor`,
    );
    expect(legacyDoctor.status()).toBe(403);

    const patientPath = appointmentCalendarPath(upcomingId, "patient");
    expect(patientPath).toBeTruthy();
    const patient = await request.get(patientPath!);
    expect(patient.status()).toBe(200);
    expect(patient.headers()["content-type"]).toContain("text/calendar");
    expect(await patient.text()).not.toContain(PATIENT_PHONE);

    // The patient's signature must not open the professional's version.
    const patientSig = new URL(patientPath!, "http://x").searchParams.get("sig");
    const swapped = await request.get(
      `/api/appointments/${upcomingId}/calendar?audience=professional&sig=${patientSig}`,
    );
    expect(swapped.status()).toBe(403);

    const professional = await request.get(appointmentCalendarPath(upcomingId, "professional")!);
    expect(professional.status()).toBe(200);
    expect(await professional.text()).toContain(PATIENT_PHONE);
  });

  test("calendar downloads expire 7 days after the appointment", async ({ request }) => {
    const expired = await request.get(appointmentCalendarPath(pastId, "patient")!);
    expect(expired.status()).toBe(410);
  });

  test("the request-sent page needs its signature", async ({ page }) => {
    test.setTimeout(90_000);
    const base = `/en/${fixture!.slug}/request-sent`;

    await page.goto(`${base}?appointmentId=${upcomingId}`);
    await expect(page).not.toHaveURL(/request-sent/, { timeout: 20_000 });
    await expect(page.getByText(patientName)).toHaveCount(0);

    await page.goto(`${base}?${appointmentRequestSentQuery(upcomingId)}`);
    await expect(page.getByTestId("booking-request-sent-page")).toBeVisible({ timeout: 20_000 });
    // Its calendar button is the signed patient link.
    await expect(page.locator('a[href*="/api/appointments/"]').first()).toHaveAttribute(
      "href",
      /audience=patient&sig=/,
    );

    await page.goto(`${base}?${appointmentRequestSentQuery(pastId)}`);
    await expect(page).not.toHaveURL(/request-sent/, { timeout: 20_000 });
  });
});
