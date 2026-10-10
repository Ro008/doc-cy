import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signInDoctorAndSetCookies } from "../helpers/doctorAuth";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { adminCookieHeader, sharedTestFounder } from "./helpers/test-admin";

/**
 * Settings redesign (design B1): a sidebar of sections, one card per clinic, removal
 * down to one clinic and one specialty, and clinic details changed by request only.
 *
 * Removing a clinic, asking for a clinic and requesting a clinic change
 * are new endpoints the backend builds after this frontend
 * (docs/handoff/settings-redesign.md); here they are stubbed with page.route and the
 * tests pin the request the page sends.
 */

type Seeded = {
  professionalId: string;
  authUserId: string;
  email: string;
  password: string;
  primaryId: string;
  secondId: string;
  nonce: string;
};

const PASSWORD = "StrongPass123!";

function nonce(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

const WEEKDAY = { enabled: true, start_time: "09:00:00", end_time: "17:00:00" };
const OFF = { enabled: false, start_time: "09:00:00", end_time: "17:00:00" };

/** A `clinics` row and the professional's link to it; returns the link id. */
async function addClinic(
  admin: SupabaseClient,
  professionalId: string,
  input: {
    token: string;
    label: string;
    /** The professional's own label for the link, when it differs from DocCy's name. */
    ownLabel?: string;
    district: string;
    address: string;
    pin: { latitude: number; longitude: number };
    isPrimary: boolean;
    paused: boolean;
  },
): Promise<string> {
  const clinic = await admin
    .from("clinics")
    .insert({
      name: input.label,
      slug: `settings-${input.token}`.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      district: input.district,
      town: input.district,
      address: input.address,
      // An active clinic needs an 8-digit Cyprus phone (clinics_active_phone_check).
      phone: `25${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`,
      ...input.pin,
    })
    .select("id")
    .single();
  if (clinic.error || !clinic.data?.id) throw new Error(`clinic: ${clinic.error?.message}`);
  const link = await admin
    .from("professional_clinics")
    .insert({
      professional_id: professionalId,
      clinic_id: String(clinic.data.id),
      is_primary: input.isPrimary,
      sort_order: input.isPrimary ? 0 : 1,
      label: input.ownLabel ?? input.label,
      pause_online_bookings: input.paused,
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
      start_time: "09:00:00",
      end_time: "17:00:00",
      weekly_schedule: {
        monday: WEEKDAY,
        tuesday: WEEKDAY,
        wednesday: WEEKDAY,
        thursday: WEEKDAY,
        friday: WEEKDAY,
        saturday: OFF,
        sunday: OFF,
      },
      slot_duration_minutes: 30,
    })
    .select("id")
    .single();
  if (link.error || !link.data?.id) throw new Error(`clinic link: ${link.error?.message}`);
  return String(link.data.id);
}

async function seed(admin: SupabaseClient, tag: string): Promise<Seeded> {
  const n = nonce();
  const email = `settings-b1-${tag}-${n}@integration.test`;
  const auth = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: "doctor" },
  });
  if (auth.error || !auth.data.user?.id) throw new Error(`auth user: ${auth.error?.message}`);

  const insert = await admin
    .from("professionals")
    .insert({
      auth_user_id: auth.data.user.id,
      name: `Settings B1 ${tag} ${n}`,
      registration_email: email,
      email,
      mobile_number: "+35799123456",
      languages: ["English"],
      slug: `settings-b1-${tag}-${n}`,
      is_registered: true,
      pro_access_until: new Date(Date.now() + 180 * 86_400_000).toISOString(),
      is_archived: false,
      is_test_profile: true,
      subscription_tier: "standard",
      trial_notice_seen_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insert.error || !insert.data?.id) throw new Error(`professional: ${insert.error?.message}`);
  const professionalId = String(insert.data.id);

  for (const specialty of ["Dermatology", "Venereology"]) {
    const { error } = await admin.from("professional_specialties").insert({
      professional_id: professionalId,
      specialty,
      license_number: `LIC-${n}`,
    });
    if (error) throw new Error(`specialty: ${error.message}`);
  }

  // Clinics the way an approved registration has them (D4: clinics + links only).
  const primary = await addClinic(admin, professionalId, {
    token: `b1p-${n}`,
    label: "Limassol Skin Clinic",
    // An old per-doctor rename: patients must still see DocCy's name.
    ownLabel: "My Limassol room",
    district: "Limassol",
    address: `Settings Street ${n}, Limassol, Cyprus`,
    pin: { latitude: 34.68, longitude: 33.04 },
    isPrimary: true,
    paused: false,
  });
  const second = await addClinic(admin, professionalId, {
    token: `b1s-${n}`,
    label: "Paphos Medical Centre",
    district: "Paphos",
    address: `Settings Avenue ${n}, Paphos, Cyprus`,
    pin: { latitude: 34.77, longitude: 32.42 },
    isPrimary: false,
    paused: true,
  });

  return {
    professionalId,
    authUserId: auth.data.user.id,
    email,
    password: PASSWORD,
    primaryId: primary,
    secondId: second,
    nonce: n,
  };
}

async function cleanup(admin: SupabaseClient, seeded: Partial<Seeded>) {
  if (seeded.professionalId) {
    const { data } = await admin
      .from("professional_clinics")
      .select("clinic_id")
      .eq("professional_id", seeded.professionalId);
    const clinicIds = [...new Set((data ?? []).map((row) => String(row.clinic_id)))];
    await admin.from("professional_specialties").delete().eq("professional_id", seeded.professionalId);
    await admin.from("professionals").delete().eq("id", seeded.professionalId);
    if (clinicIds.length) await admin.from("clinics").delete().in("id", clinicIds);
  }
  if (seeded.authUserId) await admin.auth.admin.deleteUser(seeded.authUserId);
}

async function openSettings(page: Page, seeded: Seeded, section?: string) {
  await signInDoctorAndSetCookies(page, undefined, {
    email: seeded.email,
    password: seeded.password,
  });
  await page.goto(section ? `/settings?section=${section}` : "/settings");
  await expect(page.getByTestId("settings-sidebar")).toBeVisible({ timeout: 30_000 });
}

function clinicCard(page: Page, name: string) {
  return page.getByTestId("settings-clinic-card").filter({ hasText: name });
}

/** With several clinics one card is open at a time: open this one (retried until hydrated). */
async function openClinicCard(page: Page, name: string) {
  const header = clinicCard(page, name).getByRole("button", { name, exact: true });
  await expect(async () => {
    if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
    await expect(header).toHaveAttribute("aria-expanded", "true", { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  return clinicCard(page, name);
}

test.describe("Settings redesign (B1)", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let seeded: Seeded | null = null;

  test.beforeEach(async () => {
    const env = requireSafeIntegration();
    admin = createIntegrationAdmin(env);
    seeded = await seed(admin, "ui");
  });

  test.afterEach(async () => {
    if (admin && seeded) await cleanup(admin, seeded);
    seeded = null;
  });

  test("the sidebar switches sections and the URL keeps the choice", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!);

    // Profile opens first; there is no Availability section (user, 2026-10-09).
    await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible({ timeout: 20_000 });
    const sidebar = page.getByTestId("settings-sidebar");
    await expect(sidebar.getByRole("link", { name: /Availability/ })).toHaveCount(0);

    await sidebar.getByRole("link", { name: /Services/ }).click();
    await expect(page).toHaveURL(/section=services/);
    await expect(page.getByRole("heading", { level: 1, name: "Services & prices" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Services/ })).toHaveAttribute("aria-current", "page");

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Services & prices" })).toBeVisible({
      timeout: 20_000,
    });

    // Holiday mode is on every section.
    await expect(sidebar.getByRole("switch", { name: "Holiday mode" })).toBeVisible();
  });

  test("each clinic has a card with its status and schedule", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "clinics");

    const limassol = clinicCard(page, "Limassol Skin Clinic");
    await expect(limassol).toBeVisible();
    await expect(limassol).toContainText("Taking online bookings");
    await expect(limassol.getByRole("switch", { name: /Online booking/ })).toHaveAttribute("aria-checked", "true");

    const paphos = clinicCard(page, "Paphos Medical Centre");
    await expect(paphos).toContainText("Online booking paused");
    await expect(paphos.getByRole("switch", { name: /Online booking/ })).toHaveAttribute("aria-checked", "false");
  });

  test("with several clinics, one card is open at a time", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "clinics");

    const limassol = clinicCard(page, "Limassol Skin Clinic");
    const paphos = clinicCard(page, "Paphos Medical Centre");
    const limassolHeader = limassol.getByRole("button", { name: "Limassol Skin Clinic", exact: true });
    const paphosHeader = paphos.getByRole("button", { name: "Paphos Medical Centre", exact: true });

    // The first clinic opens; the other is one line that still says and switches its booking.
    await expect(limassolHeader).toHaveAttribute("aria-expanded", "true", { timeout: 20_000 });
    await expect(limassol.getByRole("button", { name: "Edit hours" })).toBeVisible();
    await expect(paphosHeader).toHaveAttribute("aria-expanded", "false");
    await expect(paphos.getByRole("button", { name: "Edit hours" })).toHaveCount(0);
    await expect(paphos.getByRole("button", { name: "Remove clinic" })).toHaveCount(0);
    await expect(paphos).toContainText("Online booking paused");
    await expect(paphos.getByRole("switch", { name: /Online booking/ })).toBeVisible();

    // Opening one closes the other.
    await openClinicCard(page, "Paphos Medical Centre");
    await expect(paphos.getByRole("button", { name: "Edit hours" })).toBeVisible();
    await expect(paphos).toContainText(`Settings Avenue`);
    await expect(limassolHeader).toHaveAttribute("aria-expanded", "false");
    await expect(limassol.getByRole("button", { name: "Edit hours" })).toHaveCount(0, { timeout: 5_000 });

    // Its header closes it again: both are one line.
    await paphosHeader.click();
    await expect(paphosHeader).toHaveAttribute("aria-expanded", "false");
    await expect(paphos.getByRole("button", { name: "Edit hours" })).toHaveCount(0, { timeout: 5_000 });
  });

  test("a clinic can be removed until one is left", async ({ page }) => {
    test.setTimeout(120_000);
    let removed = "";
    await page.route("**/api/professional-clinics?*", async (route) => {
      if (route.request().method() !== "DELETE") return route.fallback();
      removed = new URL(route.request().url()).searchParams.get("locationId") ?? "";
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await openSettings(page, seeded!, "clinics");

    await (await openClinicCard(page, "Paphos Medical Centre")).getByRole("button", { name: "Remove clinic" }).click();
    const dialog = page.getByRole("dialog", { name: /Remove Paphos Medical Centre/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Remove clinic" }).click();

    await expect(page.getByTestId("settings-clinic-card")).toHaveCount(1);
    const last = clinicCard(page, "Limassol Skin Clinic");
    await expect(last.getByRole("button", { name: "Remove clinic" })).toHaveCount(0);
    await expect(last).toContainText("Your profile needs at least one clinic.");
    // A single clinic has nothing to fold: it stays open, with no header button.
    await expect(last.getByRole("button", { name: "Limassol Skin Clinic", exact: true })).toHaveCount(0);
    await expect(last.getByRole("button", { name: "Edit hours" })).toBeVisible();
    expect(removed).toBe(seeded!.secondId);
    // Removing is not an unsaved edit.
    await expect(page.getByTestId("settings-unsaved-changes")).toHaveCount(0);
  });

  test("clinic details change by request; the address is not editable", async ({ page }) => {
    test.setTimeout(120_000);
    let sent: unknown = null;
    await page.route("**/api/clinic-change-requests", async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ request: { createdAt: new Date().toISOString() } }),
      });
    });
    await openSettings(page, seeded!, "clinics");

    const card = clinicCard(page, "Limassol Skin Clinic");
    await expect(card.getByRole("textbox", { name: /address/i })).toHaveCount(0);
    await card.getByRole("button", { name: "Request name or address change" }).click();

    // The same picker as /register: current clinic confirmed, name and phone below.
    const dialog = page.getByRole("dialog", { name: /Request a change/ });
    await expect(dialog.getByTestId("settings-clinic-picker")).toContainText("Settings Street");
    await dialog.getByRole("button", { name: "Send request" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Change at least one detail.");

    await dialog.getByLabel("Clinic name").fill("Limassol Skin Care");
    await dialog.getByRole("button", { name: "Send request" }).click();

    await expect(dialog).toBeHidden();
    await expect(card).toContainText("Change in review");
    expect(sent).toEqual({
      locationId: seeded!.primaryId,
      changes: { name: "Limassol Skin Care" },
    });
  });

  test("a new clinic is found among DocCy's clinics first", async ({ page }) => {
    test.setTimeout(120_000);
    let sent: unknown = null;
    await page.route("**/api/clinic-requests", async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ request: { createdAt: new Date().toISOString() } }),
      });
    });
    await openSettings(page, seeded!, "clinics");

    await page.getByRole("button", { name: "+ Add clinic" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a clinic" });
    await dialog.getByRole("combobox").fill(`Settings Avenue ${seeded!.nonce}`);
    await dialog
      .getByTestId("register-clinic-search-0-option")
      .filter({ hasText: `Settings Avenue ${seeded!.nonce}` })
      .first()
      .click();
    await expect(dialog).toContainText("From DocCy");

    await dialog.getByRole("button", { name: "Add clinic" }).click();
    await expect(dialog).toBeHidden();
    const body = sent as { kind?: string; clinic?: { clinicId?: string } } | null;
    expect(body?.kind).toBe("add");
    expect(body?.clinic?.clinicId).toBeTruthy();

    // Clinics are curated by DocCy: the new one waits for review, nothing to save.
    await expect(page.getByTestId("settings-clinic-card")).toHaveCount(2);
    const pending = page.getByTestId("settings-clinic-pending");
    await expect(pending).toContainText("Request in review");
    await expect(pending).toContainText(`Settings Avenue ${seeded!.nonce}`);
    await expect(page.getByTestId("settings-unsaved-changes")).toHaveCount(0);
  });

  test("the clinic name is DocCy's, and only a request can change it", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "clinics");

    const card = clinicCard(page, "Limassol Skin Clinic");
    await expect(card).toHaveCount(1);
    await expect(page.getByTestId("settings-clinic-card").filter({ hasText: "My Limassol room" })).toHaveCount(0);

    // A click before hydration does nothing: retry until the editor opens.
    await expect(async () => {
      await card.getByRole("button", { name: "Edit hours" }).click();
      await expect(page.getByTestId("settings-clinic-name-note")).toContainText("Request name or address change", { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page.locator("#clinicName")).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Request name or address change" })).toBeVisible();
  });

  test("a clinic's hours save from its card, and Cancel puts them back", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "clinics");
    await expect(page.getByTestId("settings-clinic-card")).toHaveCount(2);
    // One save rule (user, 2026-10-01): no page-wide save bar.
    await expect(page.getByRole("button", { name: /Save settings/ })).toHaveCount(0);

    const card = clinicCard(page, "Limassol Skin Clinic");
    await card.getByRole("button", { name: "Edit hours" }).click();
    const save = card.getByTestId("settings-clinic-hours-save");
    await expect(save).toBeDisabled();

    // Cancel: back to the saved slot, nothing sent.
    await card.getByRole("radio", { name: "45 min" }).click();
    await expect(
      page.getByTestId("settings-sidebar").getByRole("link", { name: /Clinics/ }).getByLabel("Unsaved changes"),
    ).toBeVisible();
    await card.getByRole("button", { name: "Cancel" }).click();
    await expect(card).toContainText("30 min");

    // Save: only this clinic changes.
    await card.getByRole("button", { name: "Edit hours" }).click();
    await card.getByRole("radio", { name: "45 min" }).click();
    await save.click();
    await expect(page.locator("[data-sonner-toast]").getByText(/Hours saved for Limassol Skin Clinic/)).toBeVisible();
    await expect(card).toContainText("45 min");

    const rows = await admin
      .from("professional_clinics")
      .select("id, slot_duration_minutes")
      .in("id", [seeded!.primaryId, seeded!.secondId]);
    const slots = Object.fromEntries((rows.data ?? []).map((row) => [row.id, row.slot_duration_minutes]));
    expect(slots[seeded!.primaryId]).toBe(45);
    expect(slots[seeded!.secondId]).toBe(30);
  });

  // User, 2026-10-10: an end time before the start time must not be possible.
  test("a clinic's hours and each day's break are picked by quarter and must make sense", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "clinics");
    const card = clinicCard(page, "Limassol Skin Clinic");
    const save = card.getByTestId("settings-clinic-hours-save");
    const trigger = (label: string) => card.getByRole("button", { name: label, exact: true });
    const picker = (label: string) => card.getByRole("dialog", { name: label });
    const hour = (label: string, value: string) =>
      picker(label).getByRole("radiogroup", { name: "Hour" }).getByRole("radio", { name: value, exact: true });
    const minute = (label: string, value: string) =>
      picker(label).getByRole("radiogroup", { name: "Minutes" }).getByRole("radio", { name: value, exact: true });
    // Hour first, then the minutes, which closes the picker.
    const pick = async (label: string, time: string) => {
      const [h, m] = time.split(":");
      await trigger(label).click();
      await hour(label, h).click();
      await minute(label, m).click();
      await expect(picker(label)).toHaveCount(0);
      await expect(trigger(label)).toHaveText(time);
    };
    const start = "Monday start time";
    const end = "Monday end time";
    // A click before hydration does nothing: retry until the editor opens.
    await expect(async () => {
      await card.getByRole("button", { name: "Edit hours" }).click();
      await expect(trigger(start)).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    // Times are picked by hour and quarter (user, 2026-10-10): no 17:02, no long list.
    await trigger(start).click();
    await expect(picker(start).getByRole("radiogroup", { name: "Hour" }).getByRole("radio")).toHaveCount(24);
    await expect(picker(start).getByRole("radiogroup", { name: "Minutes" }).getByRole("radio")).toHaveText([
      ":00",
      ":15",
      ":30",
      ":45",
    ]);
    await page.keyboard.press("Escape");
    await expect(picker(start)).toHaveCount(0);

    await pick(start, "10:00");
    await pick(end, "12:30");
    await expect(card.getByRole("alert")).toHaveCount(0);
    await expect(save).toBeEnabled();

    // The end offers only times after the start.
    await trigger(end).click();
    await expect(hour(end, "09")).toBeDisabled();
    await expect(hour(end, "10")).toBeEnabled();
    await hour(end, "10").click();
    await expect(minute(end, "00")).toBeDisabled();
    await expect(trigger(end)).toHaveText("10:30");
    await page.keyboard.press("Escape");

    // Moving the start past the end: the row says so and nothing can be saved.
    await pick(start, "13:00");
    await expect(card.getByRole("alert")).toHaveText("Monday must end after 13:00.");
    await expect(trigger(end)).toHaveAttribute("aria-invalid", "true");
    await expect(save).toBeDisabled();

    await pick(start, "10:00");
    await pick(end, "16:00");
    await expect(card.getByRole("alert")).toHaveCount(0);
    await expect(save).toBeEnabled();

    // Each open day has its own break (user, 2026-10-10), inside that day's hours.
    await expect(card.getByLabel("Add a daily break")).toHaveCount(0);
    await card.getByRole("button", { name: "Add a break on Monday" }).click();
    await expect(trigger("Monday break start")).toHaveText("13:00");
    await expect(trigger("Monday break end")).toHaveText("14:00");
    await expect(card.getByRole("alert")).toHaveCount(0);

    // Shortening the day past the break: the row says so and nothing can be saved.
    await pick(end, "13:30");
    await expect(card.getByRole("alert")).toHaveText("Monday's break must be within its hours (10:00 – 13:30).");
    await expect(trigger("Monday break end")).toHaveAttribute("aria-invalid", "true");
    await expect(save).toBeDisabled();
    await pick(end, "16:00");
    await expect(card.getByRole("alert")).toHaveCount(0);

    // The break's pickers offer only times inside the day, the end after the start.
    await trigger("Monday break end").click();
    await expect(hour("Monday break end", "12")).toBeDisabled();
    await expect(hour("Monday break end", "13")).toBeEnabled();
    await expect(hour("Monday break end", "15")).toBeEnabled();
    await expect(hour("Monday break end", "16")).toBeDisabled();
    await page.keyboard.press("Escape");
    await trigger("Monday break start").click();
    await expect(hour("Monday break start", "09")).toBeDisabled();
    await expect(hour("Monday break start", "10")).toBeEnabled();
    await page.keyboard.press("Escape");
    await pick("Monday break start", "12:30");
    await pick("Monday break end", "13:15");

    // One click copies a day's hours and break to the other open days.
    await card.getByRole("button", { name: "Copy Monday's hours and break to the other open days" }).click();
    for (const other of ["Tuesday", "Friday"]) {
      await expect(trigger(`${other} start time`)).toHaveText("10:00");
      await expect(trigger(`${other} end time`)).toHaveText("16:00");
      await expect(trigger(`${other} break start`)).toHaveText("12:30");
      await expect(trigger(`${other} break end`)).toHaveText("13:15");
    }
    // Closed days stay closed.
    await expect(trigger("Saturday start time")).toHaveCount(0);

    // A break is removed from its day only.
    await card.getByRole("button", { name: "Remove Tuesday's break" }).click();
    await expect(trigger("Tuesday break start")).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Add a break on Tuesday" })).toBeVisible();
    await expect(trigger("Monday break start")).toHaveText("12:30");

    await save.click();
    await expect(page.locator("[data-sonner-toast]").getByText(/Hours saved for Limassol Skin Clinic/)).toBeVisible();
    // The card sums the breaks up.
    await expect(card.getByTestId("settings-clinic-break-summary")).toHaveText("Varies by day");
    const row = await admin
      .from("professional_clinics")
      .select("weekly_schedule, break_start, break_end")
      .eq("id", seeded!.primaryId)
      .single();
    expect(row.data?.weekly_schedule?.monday).toMatchObject({
      start_time: "10:00:00",
      end_time: "16:00:00",
      break_start: "12:30:00",
      break_end: "13:15:00",
    });
    expect(row.data?.weekly_schedule?.tuesday).toMatchObject({
      start_time: "10:00:00",
      end_time: "16:00:00",
      break_start: null,
      break_end: null,
    });
    expect(row.data?.weekly_schedule?.saturday).toMatchObject({ enabled: false, break_start: null });
    // The clinic's one break is no longer used.
    expect(row.data).toMatchObject({ break_start: null, break_end: null });
  });

  test("booking limits are set on each clinic and save at once, leaving a half-edited bio alone", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    let sentLocations: Array<Record<string, unknown>> = [];
    page.on("request", (request) => {
      if (request.method() !== "POST" || !request.url().endsWith("/api/doctor-settings")) return;
      sentLocations = (request.postDataJSON()?.locations ?? []) as Array<Record<string, unknown>>;
    });
    await openSettings(page, seeded!, "profile");
    await page.locator("#settings-bio").fill("A bio I have not saved");
    await expect(page.getByTestId("settings-bio-save")).toBeVisible();

    await page.getByTestId("settings-sidebar").getByRole("link", { name: /Clinics/ }).click();
    const limassol = clinicCard(page, "Limassol Skin Clinic").getByTestId("clinic-booking-limits");
    const paphos = clinicCard(page, "Paphos Medical Centre").getByTestId("clinic-booking-limits");
    await limassol.getByLabel("Minimum notice").selectOption("48");
    // EXPECTED until Livio stores limits per clinic: one value per professional, so it
    // shows on every clinic and the card says so.
    await expect(
      page.locator("[data-sonner-toast]").getByText("Booking limits saved for all your clinics."),
    ).toBeVisible();
    await expect(limassol.getByTestId("clinic-limits-scope")).toHaveText("All 2 of your clinics use these limits.");
    await expect(limassol.getByTestId("clinic-limits-pending")).toContainText("Livio");
    // One card is open at a time: the other clinic shows the same value once opened.
    await openClinicCard(page, "Paphos Medical Centre");
    await expect(paphos.getByLabel("Minimum notice")).toHaveValue("48");
    // "Apply to all" is always there with more than one clinic, and says what it did.
    await paphos.getByTestId("clinic-limits-apply-all").click();
    await expect(
      page
        .locator("[data-sonner-toast]")
        .getByText("Paphos Medical Centre's booking limits now apply to all 2 of your clinics."),
    ).toBeVisible();
    // The save already carries each clinic's limits for the backend to store.
    expect(sentLocations).toHaveLength(2);
    expect(sentLocations.every((row) => row.minimumNoticeHours === 48)).toBe(true);

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("professional_settings")
          .select("minimum_notice_hours")
          .eq("professional_id", seeded!.professionalId)
          .maybeSingle();
        return data?.minimum_notice_hours ?? null;
      })
      .toBe(48);
    const { data: pro } = await admin.from("professionals").select("bio").eq("id", seeded!.professionalId).single();
    expect(pro?.bio ?? "").not.toBe("A bio I have not saved");
  });

  test("Plan & billing shows the free period, the terms and nothing to pay", async ({ page }) => {
    test.setTimeout(120_000);
    const until = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await admin
      .from("professionals")
      .update({ pro_access_until: until, subscription_tier: "founder" })
      .eq("id", seeded!.professionalId);
    if (error) throw new Error(`plan: ${error.message}`);

    await openSettings(page, seeded!, "plan");
    await expect(page.getByRole("heading", { level: 1, name: "Plan & billing" })).toBeVisible();
    await expect(page.getByTestId("settings-plan-days-left")).toHaveText(/^(99|100) days$/);
    const terms = page.getByTestId("settings-plan-terms");
    await expect(terms).toContainText("Free, forever");
    await expect(terms).toContainText("€19/month, locked for life");
    await expect(page.getByTestId("settings-plan-payment")).toContainText("Nothing to pay today.");
    // The badge names the status here; it no longer opens a pop-up with the terms.
    await expect(page.getByTestId("settings-plan-status").getByTestId("founding-member-badge")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByTestId("settings-plan-write-founders").click();
    await expect(page.getByRole("dialog", { name: /How can we help you/i })).toBeVisible();
    await expect(page.getByText(/coming soon/i)).toHaveCount(0);
  });

  test("Profile: the name changes by request, with who she sees and her qualifications", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "profile");

    // The name is read-only; a request needs a different full name without a title.
    const nameBlock = page.getByTestId("settings-profile-name");
    await expect(nameBlock).toBeVisible({ timeout: 20_000 });
    const form = page.getByTestId("settings-name-change-form");
    await expect(async () => {
      await nameBlock.getByRole("button", { name: "Request name change" }).click();
      await expect(form).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    const nameInput = form.getByLabel(/Name as patients should see it/);
    await form.getByRole("button", { name: "Send request" }).click();
    await expect(form.getByRole("alert")).toHaveText("That is already your name on DocCy.");
    await nameInput.fill("Dr. Maria Ioannou");
    await form.getByRole("button", { name: "Send request" }).click();
    await expect(form.getByRole("alert")).toHaveText("Leave out titles such as Dr or Prof.");

    await form.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(form).toHaveCount(0);

    // Who she sees: one of three, saved when picked. Until the backend exists the
    // choice stays for this visit and the page says it is not saved.
    const ages = page.getByTestId("settings-patient-ages").getByRole("radiogroup", { name: "Patients I see" });
    await expect(ages.getByRole("radio")).toHaveText(["Adults", "Children", "Adults and children"]);
    await expect(ages.getByRole("radio", { checked: true })).toHaveCount(0);
    await ages.getByRole("radio", { name: "Children", exact: true }).click();
    await expect(page.getByText(/Shown here only for now: saving who you see/)).toBeVisible({ timeout: 20_000 });
    await expect(ages.getByRole("radio", { name: "Children", exact: true })).toHaveAttribute("aria-checked", "true");

    // Qualifications: each field says what is wrong; lines sort most recent first.
    const quals = page.getByTestId("settings-qualifications");
    await expect(quals).toContainText("None yet.");
    await quals.getByRole("button", { name: "+ Add a qualification" }).click();
    const qForm = page.getByTestId("settings-qualification-form");
    await qForm.getByRole("button", { name: "Add qualification" }).click();
    await expect(qForm).toContainText("Enter the qualification.");
    await expect(qForm).toContainText("Enter where you obtained it.");
    await qForm.getByLabel(/^Qualification/).fill("MD, Medicine");
    await qForm.getByLabel(/^Year/).fill("1900");
    await qForm.getByLabel(/Where you obtained it/).fill("University of Athens");
    await qForm.getByRole("button", { name: "Add qualification" }).click();
    await expect(qForm).toContainText(/Enter a year between 1950 and \d{4}\./);
    await qForm.getByLabel(/^Year/).fill("2009");
    await qForm.getByRole("button", { name: "Add qualification" }).click();
    await expect(page.getByText(/Shown here only for now: adding a qualification/)).toBeVisible({ timeout: 20_000 });
    await expect(quals.getByRole("listitem")).toHaveText([/MD, Medicine.*University of Athens · 2009/]);

    await quals.getByRole("button", { name: "+ Add a qualification" }).click();
    await qForm.getByLabel(/^Qualification/).fill("Fellowship in Cardiology");
    await qForm.getByLabel(/^Year/).fill("2015");
    await qForm.getByLabel(/Where you obtained it/).fill("King's College London");
    await qForm.getByRole("button", { name: "Add qualification" }).click();
    await expect(quals.getByRole("listitem")).toHaveText([/Fellowship in Cardiology/, /MD, Medicine/], {
      timeout: 20_000,
    });
    await quals.getByRole("button", { name: "Remove MD, Medicine" }).click();
    await expect(quals.getByRole("listitem")).toHaveText([/Fellowship in Cardiology/], { timeout: 20_000 });
  });

  test("Profile: a name change is sent, withdrawn, denied with a reason, then approved by a founder", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    const founder = await sharedTestFounder();
    const headers = { cookie: adminCookieHeader(founder) };
    // Letters only (a name has no digits), and unique: the profile's address follows it.
    const letters = seeded!.nonce.replace(/\D/g, "").replace(/\d/g, (d) => "abcdefghij"[Number(d)]!);
    const asked = `maria nameflow${letters}`;
    const approvedName = `Maria Nameflow${letters}`;
    const newSlug = `maria-nameflow${letters}`;
    const oldSlug = `settings-b1-ui-${seeded!.nonce}`;
    const requests = () =>
      admin
        .from("request_log")
        .select("id, status, details, before_snapshot, approved_details, decision_note")
        .eq("professional_id", seeded!.professionalId)
        .eq("request_type", "professional_name_change")
        .order("created_at", { ascending: true });
    const today = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Nicosia",
    }).format(new Date());

    await openSettings(page, seeded!, "profile");
    const nameBlock = page.getByTestId("settings-profile-name");
    const form = page.getByTestId("settings-name-change-form");
    const pending = page.getByTestId("settings-name-change-pending");
    const denied = page.getByTestId("settings-name-change-denied");
    const send = async (name: string, reason: string) => {
      await expect(async () => {
        await nameBlock.getByRole("button", { name: "Request name change" }).click();
        await expect(form).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await form.getByLabel(/Name as patients should see it/).fill(name);
      await form.getByLabel(/Why it changed/).fill(reason);
      await form.getByRole("button", { name: "Send request" }).click();
      await expect(pending).toBeVisible({ timeout: 20_000 });
    };

    try {
      // 1. Sent: the page says when, and that it waits for approval; nothing is live yet.
      await send("Maria  Withdrawn", "testing");
      await expect(pending).toContainText(`Request sent on ${today}`);
      await expect(pending).toContainText("waiting for DocCy’s approval");
      await expect(pending).toContainText("Maria Withdrawn");
      await expect(nameBlock.getByRole("button", { name: "Request name change" })).toHaveCount(0);
      let rows = (await requests()).data ?? [];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        status: "pending",
        details: { name: "Maria Withdrawn", reason: "testing" },
        before_snapshot: { slug: oldSlug },
      });
      // It is still there after a reload, and a second request is refused by the server.
      await page.reload();
      await expect(pending).toContainText(`Request sent on ${today}`, { timeout: 20_000 });
      const second = await page.request.post("/api/name-change-requests", {
        data: { name: "Maria Second", reason: null },
      });
      expect(second.status()).toBe(409);

      // 2. Withdrawn by her: gone from the page, kept in the log.
      await expect(async () => {
        await pending.getByRole("button", { name: "Withdraw request" }).click();
        await expect(pending).toHaveCount(0, { timeout: 5_000 });
      }).toPass({ timeout: 20_000 });
      await expect(nameBlock.getByRole("button", { name: "Request name change" })).toBeVisible();
      rows = (await requests()).data ?? [];
      expect(rows.map((row) => row.status)).toEqual(["withdrawn"]);

      // 3. Denied by a founder: the reason shows in Settings until she dismisses it.
      await send("Maria Denied", "");
      rows = (await requests()).data ?? [];
      const deniedId = rows[1]!.id as string;
      const noReason = await request.post(`/api/internal/profile-changes/${deniedId}/deny`, {
        headers,
        data: { reason: " " },
      });
      expect(noReason.status()).toBe(400);
      const deny = await request.post(`/api/internal/profile-changes/${deniedId}/deny`, {
        headers,
        data: { reason: "This is not the name on your licence." },
      });
      expect(deny.status(), await deny.text()).toBe(200);
      // She tries to withdraw it on the stale page: too late.
      await pending.getByRole("button", { name: "Withdraw request" }).click();
      await expect(page.getByText(/DocCy has already decided this request/)).toBeVisible({ timeout: 20_000 });
      await page.reload();
      await expect(denied).toContainText("Your name change to “Maria Denied” was not approved", { timeout: 20_000 });
      await expect(denied).toContainText("Reason: This is not the name on your licence.");
      await expect(pending).toHaveCount(0);
      await denied.getByRole("button", { name: "Dismiss" }).click();
      await expect(denied).toHaveCount(0);
      await page.reload();
      await expect(nameBlock).toBeVisible({ timeout: 20_000 });
      await expect(denied).toHaveCount(0);

      // 4. Approved by a founder on the dashboard, with the capitals corrected.
      await send(asked, "I married");
      rows = (await requests()).data ?? [];
      const approvedId = rows[2]!.id as string;
      await page.context().clearCookies();
      await page.context().addCookies(
        adminCookieHeader(founder)
          .split("; ")
          .map((pair) => {
            const at = pair.indexOf("=");
            return { name: pair.slice(0, at), value: pair.slice(at + 1), url: page.url() };
          }),
      );
      await page.goto("/internal/directory?tab=requests");
      const card = page.locator(`[data-change-request-id="${approvedId}"]`);
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(card).toContainText(`Settings B1 ui ${seeded!.nonce}`);
      await expect(card).toContainText(asked);
      await expect(card).toContainText("I married");
      const approveName = card.getByLabel(/Name to approve/);
      await expect(approveName).toHaveValue(asked);
      await expect(async () => {
        await approveName.fill(approvedName);
        await expect(card.getByText(/Differs from what was asked/)).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await card.getByRole("button", { name: "Approve", exact: true }).click();
      await expect(page.locator(`[data-decided-change-id="${approvedId}"]`)).toHaveCount(1, { timeout: 30_000 });

      const { data: pro } = await admin
        .from("professionals")
        .select("name, slug")
        .eq("id", seeded!.professionalId)
        .single();
      expect(pro).toEqual({ name: approvedName, slug: newSlug });
      rows = (await requests()).data ?? [];
      expect(rows.map((row) => row.status)).toEqual(["withdrawn", "rejected", "approved"]);
      expect(rows[2]!.details).toMatchObject({ name: asked });
      expect(rows[2]!.approved_details).toMatchObject({ name: approvedName, reason: "I married" });
      const { data: forward } = await admin
        .from("professional_slug_redirects")
        .select("professional_id")
        .eq("slug", oldSlug)
        .maybeSingle();
      expect(forward?.professional_id).toBe(seeded!.professionalId);

      // The old public address forwards to the new one.
      await page.context().clearCookies();
      await page.goto(`/en/${oldSlug}`);
      await expect(page).toHaveURL(new RegExp(`/en/${newSlug}$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { level: 1 })).toContainText(approvedName, { timeout: 20_000 });
    } finally {
      await admin.from("professional_slug_redirects").delete().eq("professional_id", seeded!.professionalId);
    }
  });

  test("Profile: a new photo waits for a founder; withdrawn, denied, approved; removing is immediate", async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(240_000);
    const founder = await sharedTestFounder();
    const headers = { cookie: adminCookieHeader(founder) };
    const fixture = path.join(process.cwd(), "tests", "fixtures", "e2e-person-avatar.jpg");
    const requests = (type = "professional_photo_change") =>
      admin
        .from("request_log")
        .select("id, status, details, before_snapshot, outcome")
        .eq("professional_id", seeded!.professionalId)
        .eq("request_type", type)
        .order("created_at", { ascending: true });
    const liveAvatar = async () =>
      (await admin.from("professionals").select("avatar_url").eq("id", seeded!.professionalId).single()).data
        ?.avatar_url as string | null;
    const waiting = async () =>
      ((await admin.storage.from("request-uploads").list(`professional_photo_change/${seeded!.professionalId}`)).data ?? [])
        .map((file) => file.name);
    const today = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Nicosia",
    }).format(new Date());

    await openSettings(page, seeded!, "profile");
    const controls = page.getByTestId("settings-photo-controls");
    const pending = page.getByTestId("settings-photo-change-pending");
    const denied = page.getByTestId("settings-photo-change-denied");
    const uploadButton = controls.getByRole("button", { name: "Upload new photo" });
    const send = async () => {
      await expect(uploadButton).toBeVisible({ timeout: 20_000 });
      await expect(async () => {
        await page.getByTestId("settings-avatar-file-input").setInputFiles(fixture);
        await expect(page.getByRole("button", { name: /Confirm crop/i })).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 20_000 });
      await page.getByRole("button", { name: /Confirm crop/i }).click();
      await expect(pending).toBeVisible({ timeout: 30_000 });
    };

    try {
      // 1. Sent: it waits in the private bucket; the live profile has no photo yet.
      await expect(controls.getByRole("button", { name: "Remove photo" })).toHaveCount(0);
      await send();
      await expect(pending).toContainText(`New photo sent on ${today}`);
      await expect(pending).toContainText("waiting for DocCy’s approval");
      await expect(pending.getByRole("img", { name: "The photo you sent" })).toBeVisible();
      await expect(uploadButton).toHaveCount(0);
      let rows = (await requests()).data ?? [];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status: "pending", before_snapshot: { avatar_url: null } });
      expect(String((rows[0]!.details as { photo_path: string }).photo_path)).toMatch(
        new RegExp(`^professional_photo_change/${seeded!.professionalId}/.+\\.jpg$`),
      );
      expect(await liveAvatar()).toBeNull();
      expect(await waiting()).toHaveLength(1);
      await page.reload();
      await expect(pending).toContainText(`New photo sent on ${today}`, { timeout: 20_000 });
      await expect(pending.getByRole("img", { name: "The photo you sent" })).toBeVisible();

      // 2. Withdrawn: the request closes and her photo is not kept.
      await expect(async () => {
        await pending.getByRole("button", { name: "Withdraw request" }).click();
        await expect(pending).toHaveCount(0, { timeout: 5_000 });
      }).toPass({ timeout: 20_000 });
      await expect(uploadButton).toBeVisible();
      expect(((await requests()).data ?? []).map((row) => row.status)).toEqual(["withdrawn"]);
      expect(await waiting()).toHaveLength(0);

      // 3. Denied by a founder: the reason shows until she dismisses it.
      await send();
      rows = (await requests()).data ?? [];
      const deny = await request.post(`/api/internal/profile-changes/${rows[1]!.id}/deny`, {
        headers,
        data: { reason: "The photo shows a logo, not you." },
      });
      expect(deny.status(), await deny.text()).toBe(200);
      await page.reload();
      await expect(denied).toContainText("Your new photo was not approved", { timeout: 20_000 });
      await expect(denied).toContainText("Reason: The photo shows a logo, not you.");
      await denied.getByRole("button", { name: "Dismiss" }).click();
      await expect(denied).toHaveCount(0);
      expect(await liveAvatar()).toBeNull();

      // 4. Approved by a founder, who sees the requested photo on the dashboard.
      await send();
      rows = (await requests()).data ?? [];
      const approvedId = rows[2]!.id as string;
      const founderContext = await browser.newContext();
      try {
        await founderContext.addCookies(
          adminCookieHeader(founder)
            .split("; ")
            .map((pair) => {
              const at = pair.indexOf("=");
              return { name: pair.slice(0, at), value: pair.slice(at + 1), url: page.url() };
            }),
        );
        const founderPage = await founderContext.newPage();
        await founderPage.goto(new URL("/internal/directory?tab=requests", page.url()).toString());
        const card = founderPage.locator(`[data-change-request-id="${approvedId}"]`);
        await expect(card).toBeVisible({ timeout: 30_000 });
        await expect(card).toContainText("Photo change");
        await expect(card.getByRole("img", { name: "Requested photo" })).toBeVisible();
        await expect(card.getByText("No photo")).toBeVisible();
        await expect(async () => {
          await card.getByRole("button", { name: "Approve", exact: true }).click();
          await expect(founderPage.locator(`[data-decided-change-id="${approvedId}"]`)).toHaveCount(1, {
            timeout: 10_000,
          });
        }).toPass({ timeout: 40_000 });
      } finally {
        await founderContext.close();
      }
      const approvedAvatar = await liveAvatar();
      expect(approvedAvatar).toMatch(new RegExp(`^profiles/${seeded!.authUserId}/avatar-.+\\.jpg$`));
      rows = (await requests()).data ?? [];
      expect(rows.map((row) => row.status)).toEqual(["withdrawn", "rejected", "approved"]);
      expect(rows[2]!.outcome).toMatchObject({ avatar_url: approvedAvatar });

      // 5. She removes it: no founder, gone at once, and recorded.
      await page.reload();
      await expect(pending).toHaveCount(0);
      await expect(async () => {
        await controls.getByRole("button", { name: "Remove photo" }).click();
        await expect(page.getByRole("dialog", { name: "Remove your photo?" })).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 20_000 });
      await page.getByRole("dialog", { name: "Remove your photo?" }).getByRole("button", { name: "Remove photo" }).click();
      await expect(page.getByText("Photo removed from your profile.")).toBeVisible({ timeout: 20_000 });
      await expect(controls.getByRole("button", { name: "Remove photo" })).toHaveCount(0);
      expect(await liveAvatar()).toBeNull();
      const removals = (await requests("professional_photo_removal")).data ?? [];
      expect(removals).toHaveLength(1);
      expect(removals[0]).toMatchObject({ status: "recorded", before_snapshot: { avatar_url: approvedAvatar } });
      const kept = (await admin.storage.from("avatars").list(`profiles/${seeded!.authUserId}`)).data ?? [];
      expect(kept).toHaveLength(0);
    } finally {
      const left = await waiting();
      if (left.length) {
        await admin.storage
          .from("request-uploads")
          .remove(left.map((name) => `professional_photo_change/${seeded!.professionalId}/${name}`));
      }
      const avatars = (await admin.storage.from("avatars").list(`profiles/${seeded!.authUserId}`)).data ?? [];
      if (avatars.length) {
        await admin.storage.from("avatars").remove(avatars.map((file) => `profiles/${seeded!.authUserId}/${file.name}`));
      }
    }
  });

  test("Profile and Services link to the public profile", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "profile");
    // Profile and Services each have one; only the open section's is visible.
    const preview = page.locator('[data-testid="settings-preview-profile"]:visible');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("href", /^\/[a-z]{2}\/[^/]+$/);
    await expect(preview).toHaveAttribute("target", "_blank");

    // It opens in a new tab, so this tab says it is opening, then that it opened.
    const popup = page.waitForEvent("popup");
    await preview.click();
    await expect(preview).toHaveAttribute("aria-busy", "true");
    await expect(preview).toContainText("Opening…");
    await (await popup).close();
    await expect(page.locator("[data-sonner-toast]").getByText("Your public profile opened in a new tab.")).toBeVisible();
    await expect(preview).toContainText("Preview profile");
  });

  test("while a block saves, its button spins and its fields are locked", async ({ page }) => {
    test.setTimeout(120_000);
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/doctor-settings", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await held;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await openSettings(page, seeded!, "profile");
    await page.locator("#settings-bio").fill("A bio that takes a while to save");
    const save = page.getByTestId("settings-bio-save");
    await save.click();

    await expect(save).toHaveAttribute("aria-busy", "true");
    await expect(save).toContainText("Saving…");
    await expect(save).toBeDisabled();
    await expect(page.locator("#settings-bio")).toHaveAttribute("readonly", "");

    release();
    await expect(page.locator("[data-sonner-toast]").getByText("Bio saved.")).toBeVisible();
    await expect(page.locator("#settings-bio")).not.toHaveAttribute("readonly", "");
  });

  test("a section that fits the window does not scroll", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1632, height: 862 });
    // A short section: Clinics with two cards is meant to scroll.
    await openSettings(page, seeded!, "plan");
    await expect(page.getByRole("heading", { level: 1, name: "Plan & billing" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("auth-about-footer")).toBeAttached();
    // Header + page + "About DocCy" footer used to add up to more than the window.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("old Availability links open Clinics, with holiday mode on phones", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await openSettings(page, seeded!, "availability");
    await expect(page.getByRole("heading", { level: 1, name: "Clinics" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("settings-availability-clinics")).toHaveCount(0);
    // The sidebar card is wide screens only; on phones holiday mode sits in Clinics.
    await expect(page.getByRole("switch", { name: "Holiday mode" })).toBeVisible();
  });

  test("old /agenda/settings links keep their section", async ({ page }) => {
    test.setTimeout(120_000);
    await signInDoctorAndSetCookies(page, undefined, {
      email: seeded!.email,
      password: seeded!.password,
    });
    await page.goto("/agenda/settings?section=clinics");
    await expect(page).toHaveURL(/\/settings\?section=clinics$/);
    await expect(page.getByRole("heading", { level: 1, name: "Clinics" })).toBeVisible();
  });

  test("specialties: removing is immediate and recorded, but never the last one", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "profile");

    const specialties = page.getByTestId("settings-specialties");
    await expect(async () => {
      await specialties.getByRole("button", { name: "Remove Venereology" }).click();
      await expect(page.getByRole("dialog", { name: /Remove Venereology/ })).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("dialog", { name: /Remove Venereology/ }).getByRole("button", { name: "Remove" }).click();

    await expect(page.getByText("Venereology removed from your profile.")).toBeVisible({ timeout: 20_000 });
    await expect(specialties).not.toContainText("Venereology");
    // One left: no ✕ any more, and the page says why.
    await expect(specialties.getByRole("button", { name: /^Remove / })).toHaveCount(0);
    await expect(specialties).toContainText("Your profile needs at least one specialty.");

    const { data: left } = await admin
      .from("professional_specialties")
      .select("specialty")
      .eq("professional_id", seeded!.professionalId);
    expect((left ?? []).map((row) => row.specialty)).toEqual(["Dermatology"]);
    const { data: log } = await admin
      .from("request_log")
      .select("status, before_snapshot")
      .eq("professional_id", seeded!.professionalId)
      .eq("request_type", "professional_specialty_removal");
    expect(log).toHaveLength(1);
    expect(log![0]).toMatchObject({ status: "recorded", before_snapshot: { name: "Venereology" } });

    // The server refuses the last one too, and says what to do instead.
    const last = await page.request.delete("/api/professional-specialties", { data: { specialty: "Dermatology" } });
    expect(last.status()).toBe(409);
    expect((await last.json()).message).toContain("Add the new one first");
    const notHers = await page.request.delete("/api/professional-specialties", { data: { specialty: "Urology" } });
    expect(notHers.status()).toBe(404);
  });

  test("GeSY: the switch saves at once and every change is recorded", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "profile");
    const gesy = page.getByRole("switch", { name: "I see GeSY patients" });
    await expect(gesy).toBeVisible({ timeout: 20_000 });
    const before = (await gesy.getAttribute("aria-checked")) === "true";
    const isGesy = async () =>
      Boolean(
        (await admin.from("professionals").select("is_gesy").eq("id", seeded!.professionalId).single()).data?.is_gesy,
      );
    const changes = async () =>
      (
        await admin
          .from("request_log")
          .select("status, details, before_snapshot")
          .eq("professional_id", seeded!.professionalId)
          .eq("request_type", "professional_gesy_change")
          .order("created_at", { ascending: true })
      ).data ?? [];

    await expect(async () => {
      if ((await gesy.getAttribute("aria-checked")) === String(before)) await gesy.click();
      await expect(gesy).toHaveAttribute("aria-checked", String(!before), { timeout: 3_000 });
      expect(await isGesy()).toBe(!before);
    }).toPass({ timeout: 30_000 });
    await expect(async () => {
      if ((await gesy.getAttribute("aria-checked")) === String(!before)) await gesy.click();
      await expect(gesy).toHaveAttribute("aria-checked", String(before), { timeout: 3_000 });
      expect(await isGesy()).toBe(before);
    }).toPass({ timeout: 30_000 });

    expect(await changes()).toEqual([
      { status: "recorded", details: { is_gesy: !before }, before_snapshot: { is_gesy: before } },
      { status: "recorded", details: { is_gesy: before }, before_snapshot: { is_gesy: !before } },
    ]);
  });

  test("Account: one sign-in & security card with the signed-in email", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "account");
    const card = page.getByTestId("settings-account-security");
    await expect(card.getByRole("heading", { name: "Sign-in & security" })).toBeVisible();
    await expect(page.getByTestId("settings-account-email")).toHaveText(seeded!.email);
    await expect(card.getByRole("button", { name: "Change password" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Sign out other devices" })).toBeVisible();
    await expect(card.getByTestId("settings-sign-out-button")).toBeVisible();
  });

  test("Account: changing the email waits for a confirmation link", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "account");
    const row = page.getByTestId("settings-account-email-row");
    await row.getByRole("button", { name: "Change email" }).click();
    const input = row.getByLabel("New email");
    const result = page.getByTestId("settings-account-email-result");

    await input.fill(seeded!.email.toUpperCase());
    await row.getByRole("button", { name: "Send confirmation link" }).click();
    await expect(result).toHaveText("That's already your email.");

    // EXPECTED TO FAIL until Livio builds POST /api/account/email: the doctor is told so.
    await input.fill("new-address@example.com");
    await input.press("Enter");
    await expect(result).toContainText("Expected to fail for now: changing your email");
    await expect(page.getByTestId("settings-account-email")).toHaveText(seeded!.email);

    // With the endpoint in place: nothing changes until the link is opened.
    let sent: unknown = null;
    await page.route("**/api/account/email", async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await row.getByRole("button", { name: "Send confirmation link" }).click();
    await expect(result).toContainText("Check new-address@example.com: open the link we sent");
    await expect(page.getByTestId("settings-account-email-pending")).toHaveText(
      "Waiting for you to confirm new-address@example.com.",
    );
    await expect(page.getByTestId("settings-account-email")).toHaveText(seeded!.email);
    expect(sent).toEqual({ email: "new-address@example.com" });
  });

  test("Promote is its own section, and old Account links land on it", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!);
    await page.goto("/settings?section=account#promote-practice");
    await expect(page).toHaveURL(/\/settings\?section=promote$/);
    await expect(page.getByRole("heading", { level: 1, name: "Promote" })).toBeVisible();
    await expect(
      page.getByTestId("settings-sidebar").getByRole("link", { name: /Promote/ }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("adding a specialty: sent with its licence number, withdrawn, denied, then approved by a founder", async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(240_000);
    const founder = await sharedTestFounder();
    const headers = { cookie: adminCookieHeader(founder) };
    const letters = seeded!.nonce.replace(/\D/g, "").replace(/\d/g, (d) => "abcdefghij"[Number(d)]!);
    const custom = `Zztest ${letters}`;
    const requests = async () =>
      (
        await admin
          .from("request_log")
          .select("id, status, details, before_snapshot, approved_details, outcome")
          .eq("professional_id", seeded!.professionalId)
          .eq("request_type", "professional_specialty_add")
          .order("created_at", { ascending: true })
      ).data ?? [];
    const hers = async () =>
      (
        (
          await admin
            .from("professional_specialties")
            .select("specialty, license_number")
            .eq("professional_id", seeded!.professionalId)
            .order("specialty")
        ).data ?? []
      ).map((row) => `${row.specialty}:${row.license_number ?? ""}`);
    const today = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Nicosia",
    }).format(new Date());
    const before = await hers();

    await openSettings(page, seeded!, "profile");
    const specialties = page.getByTestId("settings-specialties");
    const form = page.getByTestId("settings-specialty-change-form");
    const chip = page.getByTestId("settings-specialty-change-pending");
    const denied = page.getByTestId("settings-specialty-change-denied");
    const openForm = async () => {
      await expect(async () => {
        await specialties.getByRole("button", { name: "+ Add a specialty" }).click();
        await expect(form).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
    };
    const send = async (licence: string) => {
      await openForm();
      await page.getByTestId("settings-specialty-change-trigger").click();
      await form.getByRole("button", { name: "Gastroenterology", exact: true }).click();
      await page.getByLabel("License / certification number").fill(licence);
      await page.getByTestId("settings-specialty-change-submit").click();
      await expect(chip).toContainText("Gastroenterology", { timeout: 20_000 });
    };

    try {
      // One action only (no "what do you want to do?" choice); both errors at once.
      await openForm();
      await expect(form.locator("select")).toHaveCount(0);
      await expect(form).toContainText("So DocCy can check you're registered for this specialty.");
      await page.getByTestId("settings-specialty-change-submit").click();
      await expect(page.getByTestId("settings-specialty-error")).toHaveText("Choose the specialty you want to add.");
      await expect(form).toContainText("Enter your license or certification number.");
      await form.getByRole("button", { name: "Cancel", exact: true }).click();

      // 1. Sent: a chip in review, the date, and nothing on her profile yet.
      await send("CY-E2E-1");
      await expect(chip).toContainText("In review");
      await expect(specialties).toContainText(`Request sent on ${today} · waiting for DocCy’s approval`);
      await expect(specialties.getByRole("button", { name: "+ Add a specialty" })).toHaveCount(0);
      let rows = await requests();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        status: "pending",
        details: { name: "Gastroenterology", from_catalogue: true, license_number: "CY-E2E-1" },
      });
      expect(await hers()).toEqual(before);
      await page.reload();
      await expect(chip).toContainText("Gastroenterology", { timeout: 20_000 });
      const second = await page.request.post("/api/specialty-requests", {
        data: { toSpecialty: "Urology", toSpecialtyFromMaster: true, licenseNumber: "X-1" },
      });
      expect(second.status()).toBe(409);

      // 2. Withdrawn with the chip's ✕.
      await expect(async () => {
        await chip.getByRole("button", { name: "Withdraw the request for Gastroenterology" }).click();
        await expect(chip).toHaveCount(0, { timeout: 5_000 });
      }).toPass({ timeout: 20_000 });
      await expect(specialties.getByRole("button", { name: "+ Add a specialty" })).toBeVisible();
      expect((await requests()).map((row) => row.status)).toEqual(["withdrawn"]);

      // The server asks for the licence number too, and refuses one she already has.
      const noLicence = await page.request.post("/api/specialty-requests", {
        data: { toSpecialty: "Urology", toSpecialtyFromMaster: true, licenseNumber: " " },
      });
      expect(noLicence.status()).toBe(400);
      const already = await page.request.post("/api/specialty-requests", {
        data: { toSpecialty: "dermatology", toSpecialtyFromMaster: true, licenseNumber: "X-1" },
      });
      expect(already.status()).toBe(400);
      expect((await requests()).length).toBe(1);

      // 3. Denied by a founder: the reason shows until she dismisses it.
      await send("CY-E2E-2");
      rows = await requests();
      const deny = await request.post(`/api/internal/profile-changes/${rows[1]!.id}/deny`, {
        headers,
        data: { reason: "We could not verify this licence number." },
      });
      expect(deny.status(), await deny.text()).toBe(200);
      await page.reload();
      await expect(denied).toContainText("Your request to add Gastroenterology was not approved", { timeout: 20_000 });
      await expect(denied).toContainText("Reason: We could not verify this licence number.");
      await expect(chip).toHaveCount(0);
      await denied.getByRole("button", { name: "Dismiss" }).click();
      await expect(denied).toHaveCount(0);
      expect(await hers()).toEqual(before);

      // 4. Approved by a founder on the dashboard, who corrects the licence number.
      await send("cy e2e 3");
      rows = await requests();
      const approvedId = rows[2]!.id as string;
      const founderContext = await browser.newContext();
      try {
        await founderContext.addCookies(
          adminCookieHeader(founder)
            .split("; ")
            .map((pair) => {
              const at = pair.indexOf("=");
              return { name: pair.slice(0, at), value: pair.slice(at + 1), url: page.url() };
            }),
        );
        const founderPage = await founderContext.newPage();
        await founderPage.goto(new URL("/internal/directory?tab=requests", page.url()).toString());
        const card = founderPage.locator(`[data-change-request-id="${approvedId}"]`);
        await expect(card).toBeVisible({ timeout: 30_000 });
        await expect(card).toContainText("Specialty request");
        await expect(card).toContainText("Gastroenterology");
        await expect(card).toContainText("In the catalogue");
        await expect(card).toContainText("cy e2e 3");
        await expect(card).toContainText("Dermatology, Venereology");
        const licence = card.getByLabel("Licence number to approve");
        await expect(async () => {
          await licence.fill("CY-E2E-3");
          await expect(card.getByText(/Differs from what was asked/)).toBeVisible({ timeout: 2_000 });
        }).toPass({ timeout: 20_000 });
        await card.getByRole("button", { name: "Approve", exact: true }).click();
        await expect(founderPage.locator(`[data-decided-change-id="${approvedId}"]`)).toHaveCount(1, {
          timeout: 30_000,
        });
      } finally {
        await founderContext.close();
      }
      expect(await hers()).toEqual([...before, "Gastroenterology:CY-E2E-3"].sort());
      rows = await requests();
      expect(rows.map((row) => row.status)).toEqual(["withdrawn", "rejected", "approved"]);
      expect(rows[2]!.details).toMatchObject({ license_number: "cy e2e 3" });
      expect(rows[2]!.approved_details).toMatchObject({ name: "Gastroenterology", license_number: "CY-E2E-3" });
      await page.reload();
      await expect(specialties.getByRole("button", { name: "Remove Gastroenterology" })).toBeVisible({
        timeout: 20_000,
      });
      await expect(chip).toHaveCount(0);

      // 5. A specialty that is not in the catalogue joins it when approved.
      const customRequest = await page.request.post("/api/specialty-requests", {
        data: { toSpecialty: custom, toSpecialtyFromMaster: false, licenseNumber: "CY-NEW-1" },
      });
      expect(customRequest.status(), await customRequest.text()).toBe(201);
      rows = await requests();
      expect(rows[3]!.details).toMatchObject({ name: custom, from_catalogue: false, license_number: "CY-NEW-1" });
      const approve = await request.post(`/api/internal/profile-changes/${rows[3]!.id}/approve`, { headers, data: {} });
      expect(approve.status(), await approve.text()).toBe(200);
      expect(await hers()).toContain(`${custom}:CY-NEW-1`);
      const { data: inCatalogue } = await admin.from("specialties").select("name").eq("name", custom).maybeSingle();
      expect(inCatalogue?.name).toBe(custom);
    } finally {
      await admin.from("professional_specialties").delete().eq("professional_id", seeded!.professionalId).eq("specialty", custom);
      await admin.from("specialties").delete().eq("name", custom);
    }
  });
});
