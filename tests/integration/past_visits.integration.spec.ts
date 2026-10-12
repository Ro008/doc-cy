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
    // The marketing "About DocCy" footer is not shown inside the doctor's pages.
    await expect(page.getByTestId("auth-about-footer")).toHaveCount(0);

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

  test("the branded date-range picker applies a shortcut, combines with attendance and clears", async () => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await open();
    const trigger = page.getByTestId("visits-range-trigger");
    await expect(trigger).toContainText("Any date");

    await trigger.click();
    const popover = page.getByTestId("visits-range-popover");
    await expect(popover).toBeVisible();
    // Closes on Escape and on an outside click, without searching.
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await trigger.click();
    await page.getByRole("heading", { name: "Visits", exact: true }).click();
    await expect(popover).toHaveCount(0);

    // A shortcut searches right away: last 7 days has only yesterday's visit.
    await trigger.click();
    await popover.getByRole("button", { name: "Last 7 days" }).click();
    await expect(page).toHaveURL(new RegExp(`from=${dayKey(-6)}&to=${dayKey(0)}`), { timeout: 15_000 });
    await expect(page.getByTestId("past-visit")).toHaveCount(1);
    await expect(card("new")).toHaveCount(1);
    await expect(trigger).not.toContainText("Any date");

    // Attendance is a segmented control that also searches right away, and keeps the range.
    await page.getByText("No-shows", { exact: true }).click();
    await expect(page).toHaveURL(/attendance=no_show/, { timeout: 15_000 });
    await expect(page.getByTestId("past-visits-empty")).toBeVisible();
    await page.getByText("All", { exact: true }).click();
    await expect(page.getByTestId("past-visit")).toHaveCount(1);

    // "Any date" clears the range.
    await trigger.click();
    await popover.getByRole("button", { name: "Any date" }).click();
    await expect(page.getByTestId("past-visit")).toHaveCount(3);
    await expect(trigger).toContainText("Any date");
  });

  test("a visit without notes invites her to add them, and the chip lists only those", async () => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await open();
    // "old" has notes; "mid" and "new" don't (the edit test above cleared "mid").
    const chip = page.getByTestId("visits-missing-notes");
    await expect(chip.locator("xpath=..")).toContainText("Without notes");
    await expect(chip.locator("xpath=..")).toContainText("2");
    await expect(card("mid").getByTestId("past-visit-notes-preview")).toContainText("Add notes");
    await expect(card("old").getByTestId("past-visit-notes-preview")).toContainText("Mentioned chest tightness.");

    await chip.locator("xpath=..").click();
    await expect(page).toHaveURL(/notes=missing/, { timeout: 15_000 });
    await expect(page.getByTestId("past-visit")).toHaveCount(2);
    await expect(card("old")).toHaveCount(0);
    // Unchecking shows everything again.
    await page.getByTestId("visits-missing-notes").locator("xpath=..").click();
    await expect(page.getByTestId("past-visit")).toHaveCount(3);
  });

  test("a visit links to all visits with that patient, without the email or phone in the URL", async () => {
    test.setTimeout(120_000);
    await open();
    await card("old").getByRole("button").first().click();
    const link = card("old").getByTestId("past-visit-patient-history");
    // Only the visit's id: an email or phone in the URL would reach browser history, logs, analytics.
    await expect(link).toHaveAttribute("href", `/agenda/visits?patient=${ids.old}`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`patient=${ids.old}`), { timeout: 15_000 });
    // The only thing in the query is the visit's id.
    expect([...new URL(page.url()).searchParams.entries()]).toEqual([["patient", ids.old]]);
    await expect(page.getByTestId("past-visits-patient-banner")).toContainText(`Zed old ${nonce}`);
    await expect(page.getByTestId("past-visit")).toHaveCount(1);
    await expect(card("old")).toHaveCount(1);
    // Searching within the patient keeps the filter.
    await page.getByLabel("Search", { exact: true }).fill("chest");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`patient=${ids.old}`), { timeout: 15_000 });
    await expect(card("old")).toHaveCount(1);
    // "Show all visits" drops only the patient filter: the search stays.
    await page.getByRole("link", { name: "Show all visits" }).click();
    await expect(page).not.toHaveURL(/patient=/, { timeout: 15_000 });
    await expect(page).toHaveURL(/q=chest/);
    await expect(page.getByTestId("past-visits-patient-banner")).toHaveCount(0);
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page.getByTestId("past-visit")).toHaveCount(3);
  });

  test("a patient filter built on another doctor's visit shows nothing, and says nothing about it", async () => {
    await open(`?patient=${ids.foreign}`);
    await expect(page.getByTestId("past-visit")).toHaveCount(0);
    await expect(page.getByTestId("past-visits-empty")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("past-visits-patient-banner")).toContainText("this patient");
    await expect(page.locator("body")).not.toContainText("Zed foreign");
    // A made-up or malformed id is just ignored.
    await open("?patient=not-a-uuid");
    await expect(page.getByTestId("past-visit")).toHaveCount(3);
  });

  test("a page past the last one shows the first page, not an error", async () => {
    for (const qs of ["?page=99999999999", "?page=2"]) {
      await open(qs);
      await expect(page.getByTestId("past-visit")).toHaveCount(3, { timeout: 15_000 });
      // (Next's own route announcer is also an alert, so look inside the page.)
      await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    }
  });

  test("Google's tag stays off inside the doctor's area", async () => {
    test.setTimeout(120_000);
    const hosts: string[] = [];
    const onRequest = (r: import("@playwright/test").Request) => hosts.push(new URL(r.url()).hostname);
    page.on("request", onRequest);
    await open("?q=maria%40example.com");
    await expect(page.getByTestId("past-visits-search")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2_500);
    page.off("request", onRequest);
    expect(hosts.filter((h) => /googletagmanager|google-analytics|googleadservices|doubleclick/.test(h))).toEqual([]);
    expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0);
    // Nothing to ask consent for there, and the bar would cover the phone tab bar.
    await expect(page.getByTestId("cookie-consent-bar")).toHaveCount(0);
  });

  test("visits sit under month headings", async () => {
    await open();
    const headings = page.getByTestId("past-visits-month");
    await expect(headings.first()).toBeVisible({ timeout: 15_000 });
    await expect(headings.first()).toContainText(/\d+ visits?/);
  });

  test("a soft fade hides the cut-off edge while more visits sit below, and goes at the bottom", async () => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 520 });
    await open();
    const fade = page.getByTestId("visits-scroll-fade");
    await expect(page.getByTestId("past-visit").first()).toBeVisible({ timeout: 15_000 });
    await expect(fade).toHaveAttribute("data-visible", "true");
    // The page can still be growing as it settles, so keep scrolling to the real bottom.
    await expect(async () => {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(fade).toHaveAttribute("data-visible", "false", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
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

test.describe("Integration: Visits tab with two clinics", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  const clinicIds: string[] = [];
  let page: Page;
  let secondName = "";
  const nonce = `pw${Date.now()}`.slice(-12);
  const ids: Record<string, string> = {};

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Visits Two ${nonce}`, specialty: "Cardiology" });
    const first = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    const second = await seedProfessionalClinic(admin, pro.doctorId, { nonce: `${nonce}s`, district: "Limassol" });
    clinicIds.push(first.clinicId, second.clinicId);
    secondName = String((await admin.from("clinics").select("name").eq("id", second.clinicId).single()).data!.name);

    const seed = async (tag: string, clinicId: string, startIso: string) => {
      const { data, error } = await admin
        .from("appointments")
        .insert({
          professional_id: pro!.doctorId,
          clinic_id: clinicId,
          booking_source: "manual",
          patient_name: `Two ${tag} ${nonce}`,
          patient_email: `two-${tag}-${nonce}@integration.test`,
          patient_phone: "+35799333444",
          patient_gender: "male",
          patient_birthdate: "1985-02-03",
          is_new_patient: false,
          reason: `Reason ${tag}`,
          appointment_datetime: startIso,
          duration_minutes: 30,
          status: "CONFIRMED",
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`seed ${tag}: ${error?.message}`);
      ids[tag] = String(data.id);
    };
    await seed("a", first.clinicId, iso(dayKey(-2), "10:00"));
    await seed("b", second.clinicId, iso(dayKey(-3), "10:00"));

    page = await browser.newPage();
    await loginDoctorUi(page, pro.email, pro.password);
  });

  test.afterAll(async () => {
    await page?.close();
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, clinicIds);
  });

  test("the clinic dropdown marks each clinic with its colour, filters and shows the colour once chosen", async () => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    // The first load of this doctor's page can be slow on a busy CI machine: reload until it lists both.
    await expect(async () => {
      await page.goto("/agenda/visits", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("past-visit")).toHaveCount(2, { timeout: 10_000 });
    }).toPass({ timeout: 60_000 });

    const trigger = page.locator("#visits-clinic");
    await expect(trigger).toContainText("All clinics");
    await trigger.click();
    const list = page.getByTestId("visits-clinic-list");
    const options = list.getByRole("option");
    await expect(options).toHaveCount(3);
    // "All clinics" has no dot; each clinic has its own, and they differ.
    await expect(options.nth(0).locator("span.rounded-full")).toHaveCount(0);
    const dots = await options.evaluateAll((els) => els.slice(1).map((el) => el.querySelector("span.rounded-full")?.className ?? ""));
    expect(dots[0]).toMatch(/bg-/);
    expect(dots[1]).toMatch(/bg-/);
    expect(dots[0]).not.toBe(dots[1]);

    // Closes on Escape without searching.
    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);
    await expect(page).not.toHaveURL(/clinic=/);

    // Choosing a clinic searches right away and the trigger shows its dot.
    await trigger.click();
    await list.getByRole("option", { name: secondName }).click();
    await expect(page).toHaveURL(/clinic=/, { timeout: 15_000 });
    await expect(page.getByTestId("past-visit")).toHaveCount(1);
    await expect(page.locator(`[data-visit-id="${ids.b}"]`)).toHaveCount(1);
    await expect(page.locator("#visits-clinic")).toContainText(secondName);
    await expect(page.locator("#visits-clinic span.rounded-full")).toHaveCount(1);

    // The keyboard works too: ArrowUp to "All clinics" and Enter.
    await page.locator("#visits-clinic").focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Home");
    await page.keyboard.press("Enter");
    await expect(page).not.toHaveURL(/clinic=[0-9a-f]/, { timeout: 15_000 });
    await expect(page.getByTestId("past-visit")).toHaveCount(2);
  });
});
