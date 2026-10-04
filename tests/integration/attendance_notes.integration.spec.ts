import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";

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
 * Attendance and private notes (user, 2026-10-04):
 * - status stays CONFIRMED; she can switch attended / no-show once the visit has ended,
 *   until the review email has gone out;
 * - professional_notes (≤ 2,000 chars): only hers, only once the visit has started, only
 *   while CONFIRMED (no-shows too); empty clears it.
 */
const CY = "Europe/Nicosia";
const dayKey = (offset: number) => format(addDays(utcToZonedTime(new Date(), CY), offset), "yyyy-MM-dd");
const iso = (key: string, hhmm: string) => zonedTimeToUtc(`${key}T${hhmm}`, CY).toISOString();

test.describe("Integration: attendance and notes", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  const clinicIds: string[] = [];
  let linkId = "";
  let page: Page;
  const nonce = `att${Date.now()}`.slice(-12);
  const yesterday = dayKey(-1);

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Attend ${nonce}`, specialty: "Cardiology" });
    const seeded = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicIds.push(seeded.clinicId);
    linkId = seeded.locationId;
    page = await browser.newPage();
    await loginDoctorUi(page, pro.email, pro.password);
  });

  test.afterAll(async () => {
    await page?.close();
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, clinicIds);
  });

  async function visit(tag: string, startIso: string, extra: Record<string, unknown> = {}) {
    const { data, error } = await admin
      .from("appointments")
      .insert({
        professional_id: pro!.doctorId,
        clinic_id: clinicIds[0],
        booking_source: "manual",
        patient_name: `Attend Patient ${tag} ${nonce}`,
        patient_email: `attend-${tag}-${nonce}@integration.test`,
        patient_phone: "+35799444666",
        patient_gender: "male",
        patient_birthdate: "1980-01-01",
        is_new_patient: false,
        reason: "Integration: attendance",
        appointment_datetime: startIso,
        duration_minutes: 30,
        status: "CONFIRMED",
        ...extra,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`seed: ${error?.message}`);
    return String(data.id);
  }

  const read = async (id: string) =>
    (await admin.from("appointments").select("attendance, professional_notes").eq("id", id).single()).data!;
  const setAttendance = (id: string, attendance: unknown) =>
    page.request.patch(`/api/appointments/${id}/attendance`, { data: { attendance } });
  const setNotes = (id: string, notes: unknown) =>
    page.request.patch(`/api/appointments/${id}/notes`, { data: { notes } });

  test("marks a past visit as no-show and back to attended", async () => {
    const id = await visit("a", iso(yesterday, "10:00"));
    expect((await setAttendance(id, "no_show")).status()).toBe(200);
    expect((await read(id)).attendance).toBe("no_show");
    // The agenda's "Undo no-show" sends null: that means attended.
    expect((await setAttendance(id, null)).status()).toBe(200);
    expect((await read(id)).attendance).toBe("attended");
  });

  test("refuses attendance before the visit ends, on other statuses, or after the review email", async () => {
    const future = await visit("b", iso(dayKey(3), "10:00"));
    expect((await setAttendance(future, "no_show")).status()).toBe(400);

    const cancelled = await visit("c", iso(yesterday, "11:00"), { status: "CANCELLED", cancelled_by: "professional" });
    expect((await setAttendance(cancelled, "no_show")).status()).toBe(400);

    const reviewed = await visit("d", iso(yesterday, "12:00"), {
      attendance: "attended",
      review_requested_at: new Date().toISOString(),
    });
    const res = await setAttendance(reviewed, "no_show");
    expect(res.status()).toBe(409);
    expect((await read(reviewed)).attendance).toBe("attended");
  });

  test("saves, trims and clears her notes on a visit that has started", async () => {
    const id = await visit("e", iso(yesterday, "13:00"), { attendance: "no_show" });
    expect((await setNotes(id, "  Follow up in 3 months.  ")).status()).toBe(200);
    expect((await read(id)).professional_notes).toBe("Follow up in 3 months.");
    expect((await setNotes(id, "")).status()).toBe(200);
    expect((await read(id)).professional_notes).toBeNull();
  });

  test("refuses notes before the visit, on other statuses, or too long", async () => {
    const future = await visit("f", iso(dayKey(3), "11:00"));
    expect((await setNotes(future, "Too early")).status()).toBe(400);

    const declined = await visit("g", iso(yesterday, "14:00"), { status: "DECLINED", decline_reason: "Away that day, sorry." });
    expect((await setNotes(declined, "Nope")).status()).toBe(400);

    const past = await visit("h", iso(yesterday, "15:00"));
    expect((await setNotes(past, "a".repeat(2001))).status()).toBe(400);
    expect((await read(past)).professional_notes).toBeNull();
  });

  test("an anonymous caller can't set attendance or notes", async ({ request }) => {
    const id = await visit("i", iso(yesterday, "16:00"));
    expect((await request.patch(`/api/appointments/${id}/notes`, { data: { notes: "x" } })).status()).toBe(401);
    expect((await request.patch(`/api/appointments/${id}/attendance`, { data: { attendance: "no_show" } })).status()).toBe(401);
  });

  test("the agenda shows a private notes box on a past visit and saves it", async () => {
    test.setTimeout(120_000);
    const id = await visit("ui", iso(yesterday, "09:00"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/agenda?date=${yesterday}`, { waitUntil: "domcontentloaded" });
    const chip = page.locator(`[data-appointment-id="${id}"]`).filter({ visible: true });
    const box = page.getByLabel("Your notes");
    await expect(async () => {
      await chip.click();
      await expect(box).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.getByText("Private to you. Notes for your next visit with this patient.")).toBeVisible();
    await box.fill("Prefers morning visits.");
    await page.getByRole("button", { name: "Save notes" }).click();
    await expect.poll(async () => (await read(id)).professional_notes, { timeout: 15_000 }).toBe("Prefers morning visits.");
  });

  test("a new request lists her previous visits with that patient, with her notes", async () => {
    test.setTimeout(120_000);
    const email = `returning-${nonce}@integration.test`;
    await visit("p1", iso(dayKey(-20), "10:00"), { patient_email: email, professional_notes: "Allergic to penicillin." });
    await visit("p2", iso(dayKey(-10), "10:00"), { patient_email: null, patient_phone: "+357 99 777 888", attendance: "no_show" });
    await visit("other", iso(dayKey(-5), "10:00"), { patient_email: `someone-${nonce}@integration.test`, patient_phone: "+35799000111", professional_notes: "Not this patient." });
    const request = await visit("req", iso(dayKey(5), "10:00"), {
      status: "REQUESTED",
      booking_source: "online",
      patient_email: email.toUpperCase(),
      patient_phone: "99777888",
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/dashboard/appointments/${request}`, { waitUntil: "domcontentloaded" });
    const list = page.getByTestId("previous-visits");
    await expect(list).toBeVisible({ timeout: 20_000 });
    await expect(list.locator("li")).toHaveCount(2);
    await expect(list).toContainText("Allergic to penicillin.");
    await expect(list).toContainText("No-show");
    await expect(list).not.toContainText("Not this patient.");
  });
});
