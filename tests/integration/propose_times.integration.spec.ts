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
  seedProfessionalClinic,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

/**
 * Suggesting other times (user, 2026-10-04): only for a REQUESTED row (a confirmed
 * visit can only be cancelled); she sends 1 to 3 times she picked, inside opening hours
 * and free in her agenda (re-checked on send); same clinic by default, or another of
 * hers. The patient gets a hashed, single-use proposal link that expires with the
 * proposal.
 */
const CY = "Europe/Nicosia";

function weekdayKey(daysAhead: number): string {
  let day = addDays(utcToZonedTime(new Date(), CY), daysAhead);
  while (day.getDay() === 0 || day.getDay() === 6) day = addDays(day, 1);
  return format(day, "yyyy-MM-dd");
}
const iso = (dateKey: string, hhmm: string) => zonedTimeToUtc(`${dateKey}T${hhmm}`, CY).toISOString();

test.describe("Integration: propose other times", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  const clinicIds: string[] = [];
  let linkId = "";
  let otherLinkId = "";
  let otherClinicId = "";
  let page: Page;
  const nonce = `prp${Date.now()}`.slice(-12);
  const day = weekdayKey(4);

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Propose ${nonce}`, specialty: "Cardiology" });
    const seeded = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicIds.push(seeded.clinicId);
    linkId = seeded.locationId;
    const other = await seedProfessionalClinic(admin, pro.doctorId, { nonce: `${nonce}b`, district: "Limassol" });
    await admin.from("professional_clinics").update({ is_primary: false, sort_order: 1 }).eq("id", other.linkId);
    clinicIds.push(other.clinicId);
    otherLinkId = other.linkId;
    otherClinicId = other.clinicId;
    page = await browser.newPage();
    await loginDoctorUi(page, pro.email, pro.password);
  });

  test.afterAll(async () => {
    await page?.close();
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, clinicIds);
  });

  async function request(tag: string, status = "REQUESTED", hhmm = "10:00") {
    const { data, error } = await admin
      .from("appointments")
      .insert({
        professional_id: pro!.doctorId,
        clinic_id: clinicIds[0],
        booking_source: "online",
        patient_name: `Propose Patient ${tag} ${nonce}`,
        patient_email: `propose-${tag}-${nonce}@integration.test`,
        patient_phone: "+35799444555",
        patient_gender: "female",
        patient_birthdate: "1993-03-03",
        is_new_patient: true,
        reason: "Integration: propose",
        appointment_datetime: iso(day, hhmm),
        duration_minutes: 30,
        status,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`seed: ${error?.message}`);
    return String(data.id);
  }

  const propose = (id: string, data: Record<string, unknown>) =>
    page.request.post(`/api/appointments/${id}/propose-reschedule`, { data: { durationMinutes: 30, ...data } });

  test("sends the 1-3 times she picked and a hashed proposal link", async () => {
    const id = await request("a");
    const chosen = [iso(day, "11:00"), iso(day, "14:00")];
    const res = await propose(id, { proposedSlots: chosen });
    expect(res.status(), await res.text()).toBe(200);

    const { data: row } = await admin
      .from("appointments")
      .select("status, proposed_slots, proposal_expires_at, clinic_id")
      .eq("id", id)
      .single();
    expect(row!.status).toBe("NEEDS_RESCHEDULE");
    expect((row!.proposed_slots as string[]).map((s) => new Date(s).toISOString())).toEqual(chosen);
    expect(row!.clinic_id).toBe(clinicIds[0]);

    const { data: links } = await admin
      .from("appointment_links")
      .select("purpose, expires_at, used_at")
      .eq("appointment_id", id);
    expect(links).toHaveLength(1);
    expect(links![0].purpose).toBe("proposal");
    expect(new Date(links![0].expires_at).toISOString()).toBe(new Date(row!.proposal_expires_at as string).toISOString());
  });

  test("refuses more than three times, duplicates, or none", async () => {
    const id = await request("b", "REQUESTED", "09:00");
    const four = ["11:30", "12:00", "12:30", "13:00"].map((t) => iso(day, t));
    expect((await propose(id, { proposedSlots: four })).status()).toBe(400);
    expect((await propose(id, { proposedSlots: [iso(day, "11:30"), iso(day, "11:30")] })).status()).toBe(400);
    expect((await propose(id, { proposedSlots: [] })).status()).toBe(400);
  });

  test("refuses a time outside opening hours", async () => {
    const id = await request("c", "REQUESTED", "09:30");
    const res = await propose(id, { proposedSlots: [iso(day, "19:00")] });
    expect(res.status()).toBe(400);
    expect((await res.json()).code).toBe("outside_hours");
  });

  test("refuses a time another visit already has", async () => {
    await request("busy", "CONFIRMED", "15:00");
    const id = await request("d", "REQUESTED", "15:30");
    const res = await propose(id, { proposedSlots: [iso(day, "15:00")] });
    expect(res.status()).toBe(409);
  });

  test("a confirmed visit can't get a proposal (only a cancellation)", async () => {
    const id = await request("e", "CONFIRMED", "16:00");
    const res = await propose(id, { proposedSlots: [iso(day, "16:30")], rescheduleReason: "Need to move this visit." });
    expect(res.status()).toBe(400);
  });

  test("the review page pre-fills three times she can swap before sending", async () => {
    test.setTimeout(120_000);
    const id = await request("ui", "REQUESTED", "16:30");
    await page.goto(`/dashboard/appointments/${id}?intent=suggest&from=dashboard`, { waitUntil: "domcontentloaded" });
    const list = page.getByTestId("review-suggested-times").locator("li");
    await expect(list).toHaveCount(3, { timeout: 20_000 });

    // Remove the first, then add a time from another day.
    await list.first().getByRole("button", { name: /^Remove/ }).click();
    await expect(list).toHaveCount(2);
    const otherDay = weekdayKey(6);
    await page.getByLabel("Day", { exact: true }).fill(otherDay);
    await page.getByRole("button", { name: /show free times/i }).click();
    const options = page.getByTestId("review-day-options").getByRole("button");
    await expect(options.first()).toBeVisible({ timeout: 15_000 });
    await options.filter({ hasText: "11:00" }).click();
    await expect(list).toHaveCount(3);

    await page.getByRole("button", { name: /send/i }).last().click();
    await expect
      .poll(async () => {
        const { data } = await admin.from("appointments").select("status, proposed_slots").eq("id", id).single();
        return data;
      }, { timeout: 20_000 })
      .toMatchObject({ status: "NEEDS_RESCHEDULE" });
    const { data } = await admin.from("appointments").select("proposed_slots").eq("id", id).single();
    const sent = (data!.proposed_slots as string[]).map((s) => new Date(s).toISOString());
    expect(sent).toHaveLength(3);
    expect(sent).toContain(iso(otherDay, "11:00"));
  });

  test("can propose at another of her clinics", async () => {
    const id = await request("f", "REQUESTED", "13:30");
    const res = await propose(id, { proposedSlots: [iso(day, "12:00")], locationId: otherLinkId });
    expect(res.status(), await res.text()).toBe(200);
    const { data } = await admin.from("appointments").select("clinic_id").eq("id", id).single();
    expect(data).toEqual({ clinic_id: otherClinicId });
  });
});
