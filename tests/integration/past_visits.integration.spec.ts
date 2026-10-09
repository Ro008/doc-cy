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
 * Visits tab (user, 2026-10-09): her past visits (CONFIRMED and started) with the patient's
 * details, the reason, the service and her notes; searchable; notes editable from there.
 */
const CY = "Europe/Nicosia";
const dayKey = (offset: number) => format(addDays(utcToZonedTime(new Date(), CY), offset), "yyyy-MM-dd");
const iso = (key: string, hhmm: string) => zonedTimeToUtc(`${key}T${hhmm}`, CY).toISOString();

test.describe("Integration: Visits tab", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  let other: TestDoctorFixture | null = null;
  const clinicIds: string[] = [];
  let page: Page;
  const nonce = `pv${Date.now()}`.slice(-12);
  const ids: Record<string, string> = {};

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Visits ${nonce}`, specialty: "Cardiology" });
    other = await createTestDoctor({ admin, nonce: `${nonce}o`, name: `Visits Other ${nonce}`, specialty: "Cardiology" });
    const seeded = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    const seededOther = await openPrimaryClinicForBookings(admin, other.doctorId, `${nonce}o`);
    clinicIds.push(seeded.clinicId, seededOther.clinicId);

    const seed = async (tag: string, doctor: TestDoctorFixture, clinicId: string, startIso: string, extra: Record<string, unknown> = {}) => {
      const { data, error } = await admin
        .from("appointments")
        .insert({
          professional_id: doctor.doctorId,
          clinic_id: clinicId,
          booking_source: "manual",
          patient_name: `Zed ${tag} ${nonce}`,
          patient_email: `zed-${tag}-${nonce}@integration.test`,
          patient_phone: "+35799111222",
          patient_gender: "female",
          patient_birthdate: "1990-05-04",
          is_new_patient: false,
          reason: `Reason ${tag}`,
          appointment_datetime: startIso,
          duration_minutes: 30,
          status: "CONFIRMED",
          ...extra,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`seed ${tag}: ${error?.message}`);
      ids[tag] = String(data.id);
    };

    await seed("old", pro, seeded.clinicId, iso(dayKey(-30), "10:00"), {
      service_name: "Echocardiogram",
      professional_notes: "Mentioned chest tightness.",
      patient_phone: "+357 97 333 444",
    });
    await seed("mid", pro, seeded.clinicId, iso(dayKey(-10), "11:00"), { attendance: "no_show" });
    await seed("new", pro, seeded.clinicId, iso(dayKey(-1), "12:00"), { attendance: "attended" });
    // Never listed: not started yet, never took place, or another doctor's.
    await seed("future", pro, seeded.clinicId, iso(dayKey(3), "10:00"));
    await seed("cancelled", pro, seeded.clinicId, iso(dayKey(-2), "10:00"), { status: "CANCELLED", cancelled_by: "professional" });
    await seed("foreign", other, seededOther.clinicId, iso(dayKey(-3), "10:00"));

    page = await browser.newPage();
    await loginDoctorUi(page, pro.email, pro.password);
  });

  test.afterAll(async () => {
    await page?.close();
    if (pro) await deleteTestDoctor(pro);
    if (other) await deleteTestDoctor(other);
    await deleteTestClinics(admin, clinicIds);
  });

  const card = (tag: string) => page.locator(`[data-visit-id="${ids[tag]}"]`);
  const open = (qs = "") => page.goto(`/agenda/visits${qs}`, { waitUntil: "domcontentloaded" });

  test("the Visits tab opens from the navigation and lists only her past visits, newest first", async () => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/agenda", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "Visits", exact: true }).first().click();
    await expect(page).toHaveURL(/\/agenda\/visits(?:[/?#]|$)/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Visits", exact: true })).toBeVisible();

    const rows = page.getByTestId("past-visit");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toHaveAttribute("data-visit-id", ids.new);
    await expect(rows.nth(2)).toHaveAttribute("data-visit-id", ids.old);
    for (const tag of ["future", "cancelled", "foreign"]) await expect(card(tag)).toHaveCount(0);
  });

  test("a visit opens to the patient's details, the reason, the service and her notes", async () => {
    await open();
    await card("old").getByRole("button").first().click();
    const details = card("old").getByTestId("past-visit-details");
    await expect(details).toContainText(`Zed old ${nonce}`);
    await expect(details).toContainText("zed-old-");
    await expect(details).toContainText("+357 97 333 444");
    await expect(details).toContainText("Female");
    await expect(details).toContainText("born 4 May 1990");
    await expect(details).toContainText("Reason old");
    await expect(details).toContainText("Echocardiogram");
    await expect(details.getByLabel("Your notes")).toHaveValue("Mentioned chest tightness.");
  });

  test("she can edit the notes from there, and they persist", async () => {
    test.setTimeout(120_000);
    await open();
    await card("mid").getByRole("button").first().click();
    const box = card("mid").getByLabel("Your notes");
    await box.fill("Review in six weeks.");
    await card("mid").getByRole("button", { name: "Save notes" }).click();
    await expect(card("mid").getByTestId("visit-notes-saved")).toBeVisible({ timeout: 15_000 });
    const read = async () =>
      (await admin.from("appointments").select("professional_notes").eq("id", ids.mid).single()).data!.professional_notes;
    await expect.poll(read, { timeout: 15_000 }).toBe("Review in six weeks.");

    await open();
    await expect(card("mid").getByTestId("past-visit-notes-preview")).toContainText("Review in six weeks.");

    // Clearing the box clears the notes.
    await card("mid").getByRole("button").first().click();
    await card("mid").getByLabel("Your notes").fill("");
    await card("mid").getByRole("button", { name: "Save notes" }).click();
    await expect.poll(read, { timeout: 15_000 }).toBeNull();
  });

  test("searches by name, email, phone, reason, service and notes", async () => {
    test.setTimeout(120_000);
    const only = async (qs: string, tag: string) => {
      await open(qs);
      await expect(page.getByTestId("past-visit")).toHaveCount(1);
      await expect(card(tag)).toHaveCount(1);
    };
    await only(`?q=${encodeURIComponent(`Zed new ${nonce}`)}`, "new");
    await only(`?q=${encodeURIComponent(`zed-mid-${nonce}`)}`, "mid");
    await only("?q=97333444", "old");
    await only("?q=%2B357%2097%20333", "old");
    await only("?q=Reason%20mid", "mid");
    await only("?q=echocardio", "old");
    await only("?q=chest%20tight", "old");

    await open("?q=nobody-has-this-name");
    await expect(page.getByTestId("past-visits-empty")).toContainText("No visits match");
  });

  test("filters by date range and by attendance", async () => {
    test.setTimeout(120_000);
    await open(`?from=${dayKey(-12)}&to=${dayKey(-9)}`);
    await expect(page.getByTestId("past-visit")).toHaveCount(1);
    await expect(card("mid")).toHaveCount(1);

    // The end day counts: a visit on the last day of the range is in.
    await open(`?from=${dayKey(-1)}&to=${dayKey(-1)}`);
    await expect(card("new")).toHaveCount(1);

    await open("?attendance=no_show");
    await expect(page.getByTestId("past-visit")).toHaveCount(1);
    await expect(card("mid")).toHaveCount(1);

    await open("?attendance=attended");
    await expect(page.getByTestId("past-visit")).toHaveCount(2);
    await expect(card("mid")).toHaveCount(0);
  });

  test("the search form submits the filters to the URL and clears them", async () => {
    test.setTimeout(120_000);
    await open();
    await page.getByLabel("Search", { exact: true }).fill("Reason mid");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/q=Reason\+mid/, { timeout: 15_000 });
    await expect(page.getByTestId("past-visit")).toHaveCount(1);
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page.getByTestId("past-visit")).toHaveCount(3);
  });

  test("mobile: the tab bar has a Visits tab", async () => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/agenda", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("userbar-mobile-tabs")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("userbar-tab-visits").click();
    await expect(page).toHaveURL(/\/agenda\/visits(?:[/?#]|$)/, { timeout: 20_000 });
    await expect(page.getByTestId("past-visit")).toHaveCount(3);
  });

  test("signed out, the page asks her to log in", async ({ browser }) => {
    const anon = await browser.newPage();
    await anon.goto("/agenda/visits", { waitUntil: "domcontentloaded" });
    await expect(anon).toHaveURL(/\/login/, { timeout: 20_000 });
    await anon.close();
  });
});
