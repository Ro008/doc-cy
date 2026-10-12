import { createHash, randomBytes } from "node:crypto";
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
 * Joining a DocCy clinic and leaving one are immediate; asking for a new clinic and
 * for a change to a clinic's details wait for a founder. All run against the real
 * backend (the details request has its own spec: settings_clinic_details).
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
    await expect(paphos.getByRole("button", { name: "Leave clinic" })).toHaveCount(0);
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

  test("she leaves a clinic at once, told about her visits there, but never her last one", async ({ page }) => {
    test.setTimeout(120_000);
    // Two confirmed visits and one open request at the clinic she leaves: they are kept.
    const { data: link } = await admin
      .from("professional_clinics")
      .select("clinic_id")
      .eq("id", seeded!.secondId)
      .single();
    const visit = (daysAhead: number, status: string) => ({
      professional_id: seeded!.professionalId,
      clinic_id: link!.clinic_id,
      patient_name: `Leave Test ${daysAhead}`,
      patient_phone: "+35799000111",
      appointment_datetime: new Date(Date.now() + daysAhead * 86_400_000).toISOString(),
      status,
      duration_minutes: 30,
    });
    const seededVisits = await admin
      .from("appointments")
      .insert([visit(3, "CONFIRMED"), visit(4, "CONFIRMED"), visit(5, "REQUESTED")]);
    expect(seededVisits.error).toBeNull();

    await openSettings(page, seeded!, "clinics");

    await (await openClinicCard(page, "Paphos Medical Centre")).getByRole("button", { name: "Leave clinic" }).click();
    const dialog = page.getByRole("dialog", { name: /Leave Paphos Medical Centre/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("The clinic itself stays in DocCy.");
    const visits = dialog.getByTestId("settings-leave-clinic-visits");
    await expect(visits).toContainText("2 confirmed visits at this clinic stay in your agenda.", { timeout: 20_000 });
    await expect(visits).toContainText(
      "1 request at this clinic is waiting for your answer. After you leave, you can only accept or decline it. To suggest other times, do it before leaving.",
    );
    await expect(visits.getByRole("link", { name: "Open my agenda" })).toHaveAttribute("href", "/agenda");
    await dialog.getByRole("button", { name: "Leave clinic" }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    await expect(page.getByTestId("settings-clinic-card")).toHaveCount(1);
    const last = clinicCard(page, "Limassol Skin Clinic");
    await expect(last.getByRole("button", { name: "Leave clinic" })).toHaveCount(0);
    await expect(last).toContainText(
      "You need at least one clinic. To change clinic, add the new one first, then leave this one.",
    );
    // A single clinic has nothing to fold: it stays open, with no header button.
    await expect(last.getByRole("button", { name: "Limassol Skin Clinic", exact: true })).toHaveCount(0);
    await expect(last.getByRole("button", { name: "Edit hours" })).toBeVisible();
    // Leaving is not an unsaved edit.
    await expect(page.getByTestId("settings-unsaved-changes")).toHaveCount(0);

    // Her link is gone, the clinic and the visits stay, and the change is recorded
    // with the settings she had there.
    const { data: links } = await admin
      .from("professional_clinics")
      .select("id")
      .eq("professional_id", seeded!.professionalId);
    expect(links?.map((row) => row.id)).toEqual([seeded!.primaryId]);
    const { count: kept } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", seeded!.professionalId)
      .eq("clinic_id", link!.clinic_id);
    expect(kept).toBe(3);
    // The request waiting at the clinic she left: she can accept or decline it, but not
    // suggest other times (user, 2026-10-11).
    const { data: openRequest } = await admin
      .from("appointments")
      .select("id")
      .eq("professional_id", seeded!.professionalId)
      .eq("status", "REQUESTED")
      .single();
    const proposal = await page.request.post(`/api/appointments/${openRequest!.id}/propose-reschedule`, {
      data: { durationMinutes: 30 },
    });
    expect(proposal.status()).toBe(409);
    expect((await proposal.json()).code).toBe("clinic_left");
    const otherTimes = await page.request.get(
      `/api/appointments/${openRequest!.id}/alternative-slots?durationMinutes=30`,
    );
    expect(otherTimes.status()).toBe(409);
    await page.goto(`/dashboard/appointments/${openRequest!.id}`);
    await expect(page.getByTestId("review-clinic-left")).toContainText(
      "You no longer work at this clinic, so you can accept or decline this request but not suggest other times.",
      { timeout: 30_000 },
    );
    await expect(page.getByRole("button", { name: "Decline" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Suggest other times/i })).toHaveCount(0);
    const { data: log } = await admin
      .from("request_log")
      .select("status, details, before_snapshot")
      .eq("professional_id", seeded!.professionalId)
      .eq("request_type", "professional_clinic_leave");
    expect(log).toHaveLength(1);
    expect(log![0]!.status).toBe("recorded");
    expect((log![0]!.details as { clinic_name?: string }).clinic_name).toBe("Paphos Medical Centre");
    expect((log![0]!.before_snapshot as { settings?: { id?: string } }).settings?.id).toBe(seeded!.secondId);

    // The server keeps her last clinic too, whatever the page sends.
    const refused = await page.request.delete(`/api/professional-clinics?locationId=${seeded!.primaryId}`);
    expect(refused.status()).toBe(409);
    expect((await refused.json()).message).toContain("You need at least one clinic.");
    // The clinic row has visits: remove them so the cleanup can delete it.
    await admin.from("appointments").delete().eq("professional_id", seeded!.professionalId);
    await admin.from("clinics").delete().eq("id", link!.clinic_id);
  });

  test("a clinic DocCy already has is joined at once, booking off until she switches it on", async ({ page }) => {
    test.setTimeout(120_000);
    const joinName = `Join Test Clinic ${seeded!.nonce}`;
    const created = await admin
      .from("clinics")
      .insert({
        name: joinName,
        slug: `join-test-${seeded!.nonce}`,
        district: "Larnaca",
        town: "Larnaca",
        address: `Join Road ${seeded!.nonce}, Larnaca, Cyprus`,
        phone: "24123456",
        latitude: 34.91,
        longitude: 33.62,
      })
      .select("id")
      .single();
    expect(created.error).toBeNull();
    const joinClinicId = String(created.data!.id);
    try {
      await openSettings(page, seeded!, "clinics");

      await page.getByRole("button", { name: "+ Add clinic" }).click();
      const dialog = page.getByRole("dialog", { name: "Add a clinic" });
      await dialog.getByRole("combobox").fill(`Join Road ${seeded!.nonce}`);
      await dialog
        .getByTestId("register-clinic-search-0-option")
        .filter({ hasText: `Join Road ${seeded!.nonce}` })
        .first()
        .click();
      await expect(dialog).toContainText("From DocCy");
      const joining = dialog.getByTestId("settings-add-clinic-joining");
      await expect(joining).toContainText("Joining a DocCy clinic");
      await expect(joining).toContainText("It is added to your profile at once.");
      // Her own clinics are not offered in the search.
      await expect(dialog.getByTestId("settings-add-clinic-new")).toHaveCount(0);
      await dialog.getByRole("button", { name: "Join clinic" }).click();
      await expect(dialog).toBeHidden({ timeout: 20_000 });

      // Its card is there, open on its hours, and says what to do next.
      await expect(page.getByTestId("settings-clinic-card")).toHaveCount(3);
      const card = clinicCard(page, joinName);
      await expect(card.getByTestId("settings-clinic-notice")).toContainText(
        "Set your hours to take online bookings",
      );
      await expect(card).toContainText(`Join Road ${seeded!.nonce}`);
      await expect(card).toContainText("24 123456");
      await expect(card.getByRole("switch", { name: /Online booking/ })).toHaveAttribute("aria-checked", "false");
      await expect(page.getByTestId("settings-clinic-pending")).toHaveCount(0);
      await expect(page.getByTestId("settings-unsaved-changes")).toHaveCount(0);

      const { data: joined } = await admin
        .from("professional_clinics")
        .select("id, pause_online_bookings, sort_order, monday, saturday, slot_duration_minutes")
        .eq("professional_id", seeded!.professionalId)
        .eq("clinic_id", joinClinicId)
        .single();
      expect(joined).toMatchObject({
        pause_online_bookings: true,
        sort_order: 2,
        monday: true,
        saturday: false,
        slot_duration_minutes: 30,
      });
      const { data: log } = await admin
        .from("request_log")
        .select("status, details")
        .eq("professional_id", seeded!.professionalId)
        .eq("request_type", "professional_clinic_join");
      expect(log).toHaveLength(1);
      expect(log![0]!.status).toBe("recorded");
      expect(log![0]!.details).toMatchObject({ clinic_id: joinClinicId, clinic_name: joinName, link_id: joined!.id });

      // It is still there after a reload, and joining it twice is refused.
      await page.reload();
      await expect(page.getByTestId("settings-clinic-card")).toHaveCount(3, { timeout: 30_000 });
      const again = await page.request.post("/api/professional-clinics", { data: { clinicId: joinClinicId } });
      expect(again.status()).toBe(409);
      expect((await again.json()).message).toBe("You already work at this clinic.");
      const unknown = await page.request.post("/api/professional-clinics", {
        data: { clinicId: "00000000-0000-4000-8000-000000000000" },
      });
      expect(unknown.status()).toBe(404);
    } finally {
      await admin.from("professional_clinics").delete().eq("clinic_id", joinClinicId);
      await admin.from("clinics").delete().eq("id", joinClinicId);
    }
  });

  test("joining and leaving a clinic need a signed-in professional", async ({ request }) => {
    expect((await request.post("/api/professional-clinics", { data: { clinicId: "x" } })).status()).toBe(401);
    expect((await request.delete("/api/professional-clinics?locationId=x")).status()).toBe(401);
    expect(
      (await request.get("/api/professional-clinics/00000000-0000-4000-8000-000000000000/upcoming")).status(),
    ).toBe(401);
  });

  test("clinic details change by request only: the dialog is about name, address and phone", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "clinics");

    const card = clinicCard(page, "Limassol Skin Clinic");
    await expect(card.getByRole("textbox", { name: /address/i })).toHaveCount(0);
    // One link for all three details (user, 2026-10-11).
    await expect(card.getByRole("button", { name: /Request (name or address|phone) change/ })).toHaveCount(0);
    await expect(async () => {
      await card.getByRole("button", { name: "Request a change to clinic details" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    const dialog = page.getByRole("dialog", { name: "Request a change to Limassol Skin Clinic’s details" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Clinic name")).toHaveValue("Limassol Skin Clinic");
    await expect(dialog.getByTestId("settings-clinic-picker")).toContainText("Settings Street");
    // The address as it is: no heading or source chip from /register, and no DocCy search.
    await expect(dialog).not.toContainText("Patients will see");
    await expect(dialog).not.toContainText(/Pin \+ typed address/i);
    await expect(dialog.getByRole("button", { name: "Change address" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Change clinic" })).toHaveCount(0);
    // Nothing differs yet: nothing to send.
    await expect(dialog.getByTestId("settings-clinic-change-summary")).toContainText("Nothing yet");
    await expect(dialog.getByRole("button", { name: "Send request" })).toBeDisabled();
    // Nobody else works at this test clinic.
    await expect(dialog.getByTestId("settings-clinic-change-shared")).toHaveCount(0);

    await dialog.getByLabel("Clinic name").fill("Limassol Skin Care");
    await expect(dialog.getByTestId("settings-clinic-change-summary")).toContainText("Name:");
    await expect(dialog.getByTestId("settings-clinic-change-summary")).toContainText("→ Limassol Skin Care");
    await expect(dialog.getByRole("button", { name: "Send request" })).toBeEnabled();
    await dialog.getByLabel("Clinic name").fill("");
    await expect(dialog.getByRole("alert")).toHaveText("Enter the clinic name.");
    await expect(dialog.getByRole("button", { name: "Send request" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(card.getByTestId("settings-clinic-change-pending")).toHaveCount(0);
  });

  test("a new clinic waits for a founder: withdrawn, denied with a reason, approved; a 4th request in a month is refused", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    const founder = await sharedTestFounder();
    const headers = { cookie: adminCookieHeader(founder) };
    const n = seeded!.nonce;
    const clinic = (name: string) => ({
      clinicId: null,
      name,
      phone: "25 123456",
      location: {
        address: `New Road ${n}, Limassol, Cyprus`,
        latitude: 34.7,
        longitude: 33.08,
        placeId: null,
        district: "Limassol",
        town: "Limassol",
      },
    });
    const requests = () =>
      admin
        .from("request_log")
        .select("id, status, details, approved_details, outcome, decision_note")
        .eq("professional_id", seeded!.professionalId)
        .eq("request_type", "professional_clinic_add")
        .order("created_at", { ascending: true });
    const today = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Nicosia",
    }).format(new Date());
    const pendingCard = page.getByTestId("settings-clinic-pending");
    const pending = page.getByTestId("settings-clinic-add-pending");
    const denied = page.getByTestId("settings-clinic-add-denied");
    const createdClinicNames = [`Asked Clinic ${n}`, `asked clinic two ${n}`, `Asked Clinic Two ${n}`];

    try {
      await openSettings(page, seeded!, "clinics");
      // What cannot be asked.
      const bad = await page.request.post("/api/clinic-requests", {
        data: { clinic: { ...clinic("Bad Phone"), phone: "80001234" } },
      });
      expect(bad.status()).toBe(400);
      expect((await bad.json()).message).toContain("Cyprus landline or mobile");
      expect((await page.request.post("/api/clinic-requests", { data: { clinic: clinic("") } })).status()).toBe(400);

      // 1. Sent: a waiting card with the date; a second one is refused; nothing is created.
      const sent = await page.request.post("/api/clinic-requests", { data: { clinic: clinic(`Withdrawn Clinic ${n}`) } });
      expect(sent.status(), await sent.text()).toBe(201);
      await page.reload();
      await expect(pendingCard).toContainText(`Withdrawn Clinic ${n}`, { timeout: 30_000 });
      await expect(pendingCard).toContainText("New clinic · waiting for DocCy");
      await expect(pending).toContainText(`Request sent on ${today}`);
      await expect(pending).toContainText("waiting for DocCy’s approval");
      await expect(page.getByTestId("settings-clinic-card")).toHaveCount(2);
      const second = await page.request.post("/api/clinic-requests", { data: { clinic: clinic("Second") } });
      expect(second.status()).toBe(409);
      // The Add dialog says so too, but still lets her join a clinic DocCy has.
      let rows = (await requests()).data ?? [];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        status: "pending",
        details: { name: `Withdrawn Clinic ${n}`, phone: "25123456", district: "Limassol", latitude: 34.7 },
      });

      // 2. Withdrawn by her.
      await expect(async () => {
        await pending.getByRole("button", { name: "Withdraw request" }).click();
        await expect(pendingCard).toHaveCount(0, { timeout: 5_000 });
      }).toPass({ timeout: 20_000 });
      rows = (await requests()).data ?? [];
      expect(rows.map((row) => row.status)).toEqual(["withdrawn"]);

      // 3. Denied by a founder: the reason shows until she dismisses it.
      await page.request.post("/api/clinic-requests", { data: { clinic: clinic(`Denied Clinic ${n}`) } });
      rows = (await requests()).data ?? [];
      const deniedId = rows[1]!.id as string;
      expect((await request.post(`/api/internal/clinic-requests/${deniedId}/deny`, { headers, data: { reason: " " } })).status()).toBe(400);
      expect((await request.post(`/api/internal/clinic-requests/${deniedId}/deny`, { data: { reason: "x" } })).status()).not.toBe(200);
      const deny = await request.post(`/api/internal/clinic-requests/${deniedId}/deny`, {
        headers,
        data: { reason: "We could not find this clinic." },
      });
      expect(deny.status(), await deny.text()).toBe(200);
      await page.reload();
      await expect(denied).toContainText(`Your request to add Denied Clinic ${n} was not approved`, { timeout: 30_000 });
      await expect(denied).toContainText("Reason: We could not find this clinic.");
      await denied.getByRole("button", { name: "Dismiss" }).click();
      await expect(denied).toHaveCount(0);

      // 4. Approved by a founder on the dashboard, with the capitals corrected.
      await page.request.post("/api/clinic-requests", { data: { clinic: clinic(`asked clinic two ${n}`) } });
      rows = (await requests()).data ?? [];
      const approvedId = rows[2]!.id as string;
      const proCookies = await page.context().cookies();
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
      const reviewCard = page.locator(`[data-clinic-request-id="${approvedId}"]`);
      await expect(reviewCard).toBeVisible({ timeout: 30_000 });
      await expect(reviewCard).toContainText("New clinic");
      await expect(reviewCard).toContainText(`asked clinic two ${n}`);
      await expect(reviewCard).toContainText(`New Road ${n}, Limassol, Cyprus`);
      await expect(reviewCard).toContainText("+357 25 123456");
      const approveName = reviewCard.getByLabel(/Name to approve/);
      await expect(async () => {
        await approveName.fill(`Asked Clinic Two ${n}`);
        await expect(reviewCard.getByText(/Differs from what was asked/)).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await reviewCard.getByRole("button", { name: "Approve", exact: true }).click();
      await expect(page.locator(`[data-decided-clinic-request-id="${approvedId}"]`)).toHaveCount(1, { timeout: 30_000 });

      const { data: created } = await admin
        .from("clinics")
        .select("id, name, phone, district, address")
        .eq("name", `Asked Clinic Two ${n}`)
        .single();
      expect(created).toMatchObject({ phone: "25123456", district: "Limassol", address: `New Road ${n}, Limassol, Cyprus` });
      const { data: link } = await admin
        .from("professional_clinics")
        .select("pause_online_bookings, sort_order")
        .eq("professional_id", seeded!.professionalId)
        .eq("clinic_id", created!.id)
        .single();
      expect(link).toEqual({ pause_online_bookings: true, sort_order: 2 });
      rows = (await requests()).data ?? [];
      expect(rows.map((row) => row.status)).toEqual(["withdrawn", "rejected", "approved"]);
      expect(rows[2]!.approved_details).toMatchObject({ name: `Asked Clinic Two ${n}` });
      expect(rows[2]!.outcome).toMatchObject({ clinic_id: created!.id, created: true });

      // She sees the new clinic on her Clinics tab, booking off.
      await page.context().clearCookies();
      await page.context().addCookies(proCookies);
      await page.goto("/settings?section=clinics");
      await expect(page.getByTestId("settings-clinic-card")).toHaveCount(3, { timeout: 30_000 });
      await expect(clinicCard(page, `Asked Clinic Two ${n}`)).toContainText("Online booking paused");
      await expect(pendingCard).toHaveCount(0);

      // 5. Three requests in 30 days is the limit (request_types), withdrawn and denied ones
      //    included: a fourth is refused, and she is told when she can send another.
      const fourth = await page.request.post("/api/clinic-requests", { data: { clinic: clinic(`Asked Clinic ${n}`) } });
      expect(fourth.status(), await fourth.text()).toBe(429);
      expect((await fourth.json()).message).toMatch(
        /^You have reached the limit for this change\. You can make it again on \d{2}\/\d{2}\/\d{4} at \d{2}:\d{2}\. If it is urgent, contact us\.$/,
      );
      expect(((await requests()).data ?? []).length).toBe(3);
    } finally {
      const { data: leftovers } = await admin.from("clinics").select("id").in("name", [...createdClinicNames, `Already Here ${n}`]);
      const ids = (leftovers ?? []).map((row) => String(row.id));
      if (ids.length) {
        await admin.from("professional_clinics").delete().in("clinic_id", ids);
        await admin.from("clinics").delete().in("id", ids);
      }
    }
  });

  test("a new-clinic request for a clinic DocCy already has: the founder joins her to it, nothing is created", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const founder = await sharedTestFounder();
    const headers = { cookie: adminCookieHeader(founder) };
    const n = seeded!.nonce;
    const clinic = (name: string) => ({
      clinicId: null,
      name,
      phone: "25 123456",
      location: {
        address: `New Road ${n}, Limassol, Cyprus`,
        latitude: 34.7,
        longitude: 33.08,
        placeId: null,
        district: "Limassol",
        town: "Limassol",
      },
    });
    const requests = () =>
      admin
        .from("request_log")
        .select("id, status, details, approved_details, outcome, decision_note")
        .eq("professional_id", seeded!.professionalId)
        .eq("request_type", "professional_clinic_add")
        .order("created_at", { ascending: true });

    try {
      await openSettings(page, seeded!, "clinics");
      const existing = await admin
        .from("clinics")
        .insert({
          name: `Already Here ${n}`,
          slug: `already-here-${n}`,
          district: "Larnaca",
          address: `Old Road ${n}, Larnaca`,
          phone: "24123456",
        })
        .select("id")
        .single();
      expect(existing.error).toBeNull();
      await page.request.post("/api/clinic-requests", { data: { clinic: clinic(`Asked Clinic ${n}`) } });
      let rows = (await requests()).data ?? [];
      const joinedId = rows[0]!.id as string;
      const joined = await request.post(`/api/internal/clinic-requests/${joinedId}/approve`, {
        headers,
        data: { existingClinicId: existing.data!.id },
      });
      expect(joined.status(), await joined.text()).toBe(200);
      const { count: copies } = await admin
        .from("clinics")
        .select("id", { count: "exact", head: true })
        .eq("name", `Asked Clinic ${n}`);
      expect(copies).toBe(0);
      const { count: hers } = await admin
        .from("professional_clinics")
        .select("id", { count: "exact", head: true })
        .eq("professional_id", seeded!.professionalId)
        .eq("clinic_id", existing.data!.id);
      expect(hers).toBe(1);
      rows = (await requests()).data ?? [];
      expect(rows[0]!.outcome).toMatchObject({ clinic_id: existing.data!.id, created: false });
    } finally {
      const { data: leftovers } = await admin.from("clinics").select("id").in("name", [`Asked Clinic ${n}`, `Already Here ${n}`]);
      const ids = (leftovers ?? []).map((row) => String(row.id));
      if (ids.length) {
        await admin.from("professional_clinics").delete().in("clinic_id", ids);
        await admin.from("clinics").delete().in("id", ids);
      }
    }
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
      await expect(page.getByTestId("settings-clinic-name-note")).toContainText("Request a change to clinic details", { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page.locator("#clinicName")).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Request a change to clinic details" })).toBeVisible();
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
    // The first save of a run compiles the route on a dev server: allow for it.
    await expect(page.locator("[data-sonner-toast]").getByText(/Hours saved for Limassol Skin Clinic/)).toBeVisible({
      timeout: 20_000,
    });
    await expect(card).toContainText("45 min");

    const rows = await admin
      .from("professional_clinics")
      .select("id, slot_duration_minutes")
      .in("id", [seeded!.primaryId, seeded!.secondId]);
    const slots = Object.fromEntries((rows.data ?? []).map((row) => [row.id, row.slot_duration_minutes]));
    expect(slots[seeded!.primaryId]).toBe(45);
    expect(slots[seeded!.secondId]).toBe(30);

    // Recorded (user, 2026-10-11): the week and slot before and after, for that clinic only.
    const hoursChanges = async () =>
      (
        await admin
          .from("request_log")
          .select("status, details, before_snapshot")
          .eq("professional_id", seeded!.professionalId)
          .eq("request_type", "professional_clinic_hours_change")
          .order("created_at", { ascending: true })
      ).data ?? [];
    const recordedHours = await hoursChanges();
    expect(recordedHours).toHaveLength(1);
    expect(recordedHours[0].status).toBe("recorded");
    expect(recordedHours[0].details).toMatchObject({
      link_id: seeded!.primaryId,
      clinic_name: "Limassol Skin Clinic",
      slot_duration_minutes: 45,
    });
    expect(recordedHours[0].before_snapshot).toMatchObject({ slot_duration_minutes: 30 });

    // Back to 30 minutes: a second record. The other clinic was sent too, unchanged: none for it.
    await card.getByRole("button", { name: "Edit hours" }).click();
    await card.getByRole("radio", { name: "30 min" }).click();
    await save.click();
    await expect(card).toContainText("30 min", { timeout: 20_000 });
    await expect.poll(async () => (await hoursChanges()).length, { timeout: 20_000 }).toBe(2);
    expect((await hoursChanges()).every((row) => row.details.link_id === seeded!.primaryId)).toBe(true);
  });

  test("the online-booking switch of a clinic is saved and recorded", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "clinics");
    const card = clinicCard(page, "Limassol Skin Clinic");
    const toggle = card.getByRole("switch", { name: /Online booking/ });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    const switches = async () =>
      (
        await admin
          .from("request_log")
          .select("status, details, before_snapshot")
          .eq("professional_id", seeded!.professionalId)
          .eq("request_type", "professional_clinic_online_booking_change")
          .order("created_at", { ascending: true })
      ).data ?? [];
    const before = (await switches()).length;

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false", { timeout: 20_000 });
    await expect.poll(async () => (await switches()).length, { timeout: 20_000 }).toBe(before + 1);
    const off = (await switches())[before];
    expect(off.status).toBe("recorded");
    expect(off.details).toMatchObject({
      link_id: seeded!.primaryId,
      clinic_name: "Limassol Skin Clinic",
      online_booking: false,
    });
    expect(off.before_snapshot).toEqual({ online_booking: true });

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true", { timeout: 20_000 });
    await expect.poll(async () => (await switches()).length, { timeout: 20_000 }).toBe(before + 2);
    const { data: link } = await admin
      .from("professional_clinics")
      .select("pause_online_bookings")
      .eq("id", seeded!.primaryId)
      .single();
    expect(link?.pause_online_bookings).toBe(false);
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
    const limitsOf = async () => {
      const { data } = await admin
        .from("professional_clinics")
        .select("id, booking_horizon_days, minimum_notice_hours, patient_cancel_notice_hours")
        .in("id", [seeded!.primaryId, seeded!.secondId]);
      return Object.fromEntries((data ?? []).map((row) => [row.id, row]));
    };
    const limitChanges = async () =>
      (
        await admin
          .from("request_log")
          .select("status, details, before_snapshot")
          .eq("professional_id", seeded!.professionalId)
          .eq("request_type", "professional_clinic_limits_change")
          .order("created_at", { ascending: true })
      ).data ?? [];

    // Each clinic has its own limits (user, 2026-10-11): a change stays on that clinic.
    await limassol.getByLabel("Minimum notice").selectOption("48");
    await expect(
      page.locator("[data-sonner-toast]").getByText("Booking limits saved for Limassol Skin Clinic."),
    ).toBeVisible({ timeout: 20_000 });
    await expect(limassol.getByTestId("clinic-limits-scope")).toHaveText(
      "Only for this clinic. Your other clinics keep their own limits.",
    );
    // The note about limits shared by every clinic is gone.
    await expect(page.getByTestId("clinic-limits-pending")).toHaveCount(0);
    await expect(page.getByText(/Expected for now/)).toHaveCount(0);
    await expect.poll(async () => (await limitsOf())[seeded!.primaryId]?.minimum_notice_hours).toBe(48);
    expect((await limitsOf())[seeded!.secondId]?.minimum_notice_hours).toBe(2);
    // The save carries each clinic's own limits.
    expect(sentLocations).toHaveLength(2);
    expect(sentLocations.map((row) => row.minimumNoticeHours).sort()).toEqual([2, 48]);

    // Recorded once, for that clinic, with the limits before.
    const first = await limitChanges();
    expect(first).toHaveLength(1);
    expect(first[0].status).toBe("recorded");
    expect(first[0].details).toMatchObject({
      link_id: seeded!.primaryId,
      clinic_name: "Limassol Skin Clinic",
      minimum_notice_hours: 48,
    });
    expect(first[0].before_snapshot).toMatchObject({ minimum_notice_hours: 2 });

    // The cancellation deadline is a limit of the clinic too.
    await limassol.getByLabel("Online cancellation").selectOption("24");
    await expect.poll(async () => (await limitsOf())[seeded!.primaryId]?.patient_cancel_notice_hours).toBe(24);
    expect((await limitsOf())[seeded!.secondId]?.patient_cancel_notice_hours).toBe(12);

    // One card is open at a time: the other clinic still shows its own value.
    await openClinicCard(page, "Paphos Medical Centre");
    await expect(paphos.getByLabel("Minimum notice")).toHaveValue("2");
    // "Apply to all" is always there with more than one clinic, and says what it did.
    await paphos.getByTestId("clinic-limits-apply-all").click();
    await expect(
      page
        .locator("[data-sonner-toast]")
        .getByText("Paphos Medical Centre's booking limits now apply to all 2 of your clinics."),
    ).toBeVisible({ timeout: 20_000 });
    await expect(paphos.getByTestId("clinic-limits-scope")).toHaveText("All 2 of your clinics use these limits.");
    await expect
      .poll(async () => {
        const limits = await limitsOf();
        return [limits[seeded!.primaryId]?.minimum_notice_hours, limits[seeded!.primaryId]?.patient_cancel_notice_hours];
      })
      .toEqual([2, 12]);
    // Only the clinic that changed got a record: three in all, none for Paphos.
    const all = await limitChanges();
    expect(all).toHaveLength(3);
    expect(all.every((row) => row.details.link_id === seeded!.primaryId)).toBe(true);

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

    // Who she sees: one of three, saved when picked, with no founder; each change recorded.
    const recorded = async (type: string) =>
      (
        await admin
          .from("request_log")
          .select("status, details, before_snapshot")
          .eq("professional_id", seeded!.professionalId)
          .eq("request_type", type)
          .order("created_at", { ascending: true })
      ).data ?? [];
    const ages = page.getByTestId("settings-patient-ages").getByRole("radiogroup", { name: "Patients I see" });
    await expect(ages.getByRole("radio")).toHaveText(["Adults", "Children", "Adults and children"]);
    await expect(ages.getByRole("radio", { checked: true })).toHaveCount(0);
    await ages.getByRole("radio", { name: "Children", exact: true }).click();
    await expect(page.getByText("Saved. Your profile now says who you see.")).toBeVisible({ timeout: 20_000 });
    await expect(ages.getByRole("radio", { name: "Children", exact: true })).toHaveAttribute("aria-checked", "true");
    await ages.getByRole("radio", { name: "Adults and children", exact: true }).click();
    await expect(ages.getByRole("radio", { name: "Adults and children", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect
      .poll(async () => recorded("professional_patients_seen_change"), { timeout: 20_000 })
      .toEqual([
        { status: "recorded", details: { patients_seen: "children" }, before_snapshot: { patients_seen: null } },
        { status: "recorded", details: { patients_seen: "all" }, before_snapshot: { patients_seen: "children" } },
      ]);
    expect(
      (await admin.from("professionals").select("patients_seen").eq("id", seeded!.professionalId).single()).data
        ?.patients_seen,
    ).toBe("all");

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
    await expect(page.getByText("Qualification added to your profile.")).toBeVisible({ timeout: 20_000 });
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

    // Saved on her profile and recorded: two added, one removed.
    const saved = (
      await admin.from("professionals").select("qualifications").eq("id", seeded!.professionalId).single()
    ).data?.qualifications as Array<Record<string, unknown>>;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      title: "Fellowship in Cardiology",
      institution: "King's College London",
      year: 2015,
    });
    const added = await recorded("professional_qualification_add");
    expect(added.map((row) => [row.status, row.details.title])).toEqual([
      ["recorded", "MD, Medicine"],
      ["recorded", "Fellowship in Cardiology"],
    ]);
    const removed = await recorded("professional_qualification_removal");
    expect(removed).toHaveLength(1);
    expect(removed[0].details).toMatchObject({ title: "MD, Medicine", year: 2009 });
    expect(removed[0].before_snapshot.qualifications).toHaveLength(2);

    // Both are still there after a reload.
    await page.reload();
    await expect(
      page.getByTestId("settings-patient-ages").getByRole("radio", { name: "Adults and children", exact: true }),
    ).toHaveAttribute("aria-checked", "true", { timeout: 20_000 });
    await expect(page.getByTestId("settings-qualifications").getByRole("listitem")).toHaveText([
      /Fellowship in Cardiology.*King's College London · 2015/,
    ]);
  });

  test("Profile: the bio and the languages save at once and every change is recorded", async ({ page }) => {
    test.setTimeout(120_000);
    const recorded = async (type: string) =>
      (
        await admin
          .from("request_log")
          .select("status, details, before_snapshot")
          .eq("professional_id", seeded!.professionalId)
          .eq("request_type", type)
          .order("created_at", { ascending: true })
      ).data ?? [];
    const profile = async () =>
      (await admin.from("professionals").select("bio, languages").eq("id", seeded!.professionalId).single()).data;
    const before = await profile();
    const bioBefore = (await recorded("professional_bio_change")).length;
    const languagesBefore = (await recorded("professional_languages_change")).length;

    await openSettings(page, seeded!, "profile");
    const bio = page.locator("#settings-bio");
    await expect(async () => {
      await bio.fill("I help people with their skin.");
      await page.getByTestId("settings-bio-save").click({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page.locator("[data-sonner-toast]").getByText("Bio saved.")).toBeVisible({ timeout: 20_000 });
    expect((await profile())?.bio).toBe("I help people with their skin.");
    const bioChanges = await recorded("professional_bio_change");
    expect(bioChanges.slice(bioBefore)).toEqual([
      {
        status: "recorded",
        details: { bio: "I help people with their skin." },
        before_snapshot: { bio: before?.bio ?? null },
      },
    ]);
    // Saving the bio sent the same languages too: nothing recorded for them.
    expect(await recorded("professional_languages_change")).toHaveLength(languagesBefore);

    await page.getByTestId("language-multiselect-trigger").click();
    await page.getByRole("listbox").getByRole("option", { name: "Greek", exact: true }).click();
    await expect(page.locator("[data-sonner-toast]").getByText("Languages saved.")).toBeVisible({
      timeout: 20_000,
    });
    // The picker keeps its own order, so compare the languages whatever their order.
    const withGreek = [...(before?.languages ?? []), "Greek"].sort();
    expect([...((await profile())?.languages ?? [])].sort()).toEqual(withGreek);
    const languageChanges = (await recorded("professional_languages_change")).slice(languagesBefore);
    expect(languageChanges).toHaveLength(1);
    expect(languageChanges[0].status).toBe("recorded");
    expect([...languageChanges[0].details.languages].sort()).toEqual(withGreek);
    expect(languageChanges[0].before_snapshot).toEqual({ languages: before?.languages ?? [] });
    // The bio was sent again with the languages, unchanged: still one record.
    expect(await recorded("professional_bio_change")).toHaveLength(bioChanges.length);
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

  test("Services: a price list she adds to, edits and removes from, every change recorded", async ({ page }) => {
    test.setTimeout(120_000);
    const recorded = async (type: string) =>
      (
        await admin
          .from("request_log")
          .select("status, details")
          .eq("professional_id", seeded!.professionalId)
          .eq("request_type", type)
          .order("created_at", { ascending: true })
      ).data ?? [];
    const saved = async () =>
      (
        await admin
          .from("professional_services")
          .select("name, price")
          .eq("professional_id", seeded!.professionalId)
          .order("created_at", { ascending: true })
      ).data ?? [];
    // Start from an empty list, through the same function the page uses.
    for (const row of (
      await admin.from("professional_services").select("id").eq("professional_id", seeded!.professionalId)
    ).data ?? []) {
      await admin.rpc("professional_service_remove", {
        p_professional_id: seeded!.professionalId,
        p_service_id: row.id,
      });
    }
    const addsBefore = (await recorded("professional_service_add")).length;
    const changesBefore = (await recorded("professional_service_change")).length;
    const removalsBefore = (await recorded("professional_service_removal")).length;

    await openSettings(page, seeded!, "services");
    const card = page.getByTestId("settings-services");
    const form = card.getByTestId("settings-service-form");
    const rows = card.getByRole("listitem");
    const toastText = (text: string | RegExp) => page.locator("[data-sonner-toast]").getByText(text);

    // Nothing listed: the form is already open, with nothing to cancel.
    await expect(card.getByText(/Nothing listed yet/)).toBeVisible({ timeout: 20_000 });
    await expect(form).toBeVisible();
    await expect(form.getByRole("button", { name: "Cancel" })).toHaveCount(0);

    // A name is needed, and the price is an amount in euros.
    await expect(async () => {
      await form.getByRole("button", { name: "Add service" }).click({ timeout: 2_000 });
      await expect(form.getByText("Enter the name of the service.")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await form.getByLabel(/^Service/).fill("First consultation");
    await form.getByLabel(/^Price/).fill("sixty");
    await form.getByRole("button", { name: "Add service" }).click();
    await expect(form.getByText("Enter an amount in euros, for example 60 or 49.50.")).toBeVisible();

    await form.getByLabel(/^Price/).fill("60");
    await form.getByRole("button", { name: "Add service" }).click();
    await expect(toastText("Service added to your price list.")).toBeVisible({ timeout: 20_000 });
    await expect(rows).toHaveText([/First consultation.*€60/]);
    await expect(card.getByTestId("settings-services-count")).toHaveText("1 of 20");
    await expect(form).toHaveCount(0);

    // A starting price reads "From €80".
    await card.getByRole("button", { name: "+ Add a service" }).click();
    await form.getByLabel(/^Service/).fill("Facial laser");
    await form.getByLabel(/^Price/).fill("80");
    await form.getByLabel(/This is a starting price/).check();
    await form.getByRole("button", { name: "Add service" }).click();
    await expect(rows).toHaveText([/First consultation.*€60/, /Facial laser.*From €80/], { timeout: 20_000 });

    // The same name twice is refused before anything is sent.
    await card.getByRole("button", { name: "+ Add a service" }).click();
    await form.getByLabel(/^Service/).fill("first  CONSULTATION");
    await form.getByRole("button", { name: "Add service" }).click();
    await expect(form.getByText("You already list a service with this name.")).toBeVisible();
    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(form).toHaveCount(0);

    // Editing a line in place: the form opens with its values.
    await card.getByRole("button", { name: "Edit First consultation" }).click();
    await expect(form.getByLabel(/^Service/)).toHaveValue("First consultation");
    await expect(form.getByLabel(/^Price/)).toHaveValue("60");
    await form.getByLabel(/^Price/).fill("70");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(toastText("Service saved.")).toBeVisible({ timeout: 20_000 });
    await expect(rows).toHaveText([/First consultation.*€70/, /Facial laser.*From €80/]);

    // Removing asks first (user, 2026-10-10): "Keep it" changes nothing.
    await card.getByRole("button", { name: "Remove Facial laser" }).click();
    const confirm = page.getByRole("dialog", { name: "Remove Facial laser?" });
    await expect(confirm).toContainText("It comes off your price list and your public profile right away.");
    await confirm.getByRole("button", { name: "Keep it" }).click();
    await expect(confirm).toHaveCount(0);
    await expect(rows).toHaveText([/First consultation.*€70/, /Facial laser.*From €80/]);

    await card.getByRole("button", { name: "Remove Facial laser" }).click();
    await confirm.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(toastText("Service removed.")).toBeVisible({ timeout: 20_000 });
    await expect(confirm).toHaveCount(0);
    await expect(rows).toHaveText([/First consultation.*€70/]);

    // Saved, and each step recorded: two added, one changed, one removed.
    await expect.poll(saved, { timeout: 20_000 }).toEqual([{ name: "First consultation", price: "70" }]);
    expect(
      (await recorded("professional_service_add")).slice(addsBefore).map((row) => [row.status, row.details.name, row.details.price]),
    ).toEqual([
      ["recorded", "First consultation", "60"],
      ["recorded", "Facial laser", "From 80"],
    ]);
    expect(
      (await recorded("professional_service_change")).slice(changesBefore).map((row) => [row.details.name, row.details.price]),
    ).toEqual([["First consultation", "70"]]);
    expect(
      (await recorded("professional_service_removal")).slice(removalsBefore).map((row) => row.details.name),
    ).toEqual(["Facial laser"]);

    // Still there after a reload.
    await page.reload();
    await expect(page.getByTestId("settings-services").getByRole("listitem")).toHaveText(
      [/First consultation.*€70/],
      { timeout: 20_000 },
    );

    // The old route is gone.
    const direct = await page.evaluate(async () => {
      const res = await fetch("/api/doctor-services", { method: "POST", body: "{}" });
      return res.status;
    });
    expect(direct).toBe(404);
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

  test("hours that leave a visit outside ask first; Apply to all copies the week and the slot length", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    // A confirmed visit at 10:00 on the next weekday at least three days ahead (Cyprus).
    const cyprusDay = (daysAhead: number) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Nicosia" }).format(
        new Date(Date.now() + daysAhead * 86_400_000),
      );
    let daysAhead = 3;
    const weekdayOf = (iso: string) =>
      new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" }).toLowerCase();
    while (["saturday", "sunday"].includes(weekdayOf(cyprusDay(daysAhead)))) daysAhead += 1;
    const visitDay = cyprusDay(daysAhead);
    const weekday = weekdayOf(visitDay);
    // 10:00 in Cyprus, whatever its offset that day: found by trying both.
    const visitAt = ["+03:00", "+02:00"]
      .map((offset) => new Date(`${visitDay}T10:00:00${offset}`))
      .find(
        (date) =>
          new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Nicosia", hour: "2-digit", hourCycle: "h23" }).format(
            date,
          ) === "10",
      )!;
    const { data: link } = await admin
      .from("professional_clinics")
      .select("clinic_id")
      .eq("id", seeded!.primaryId)
      .single();
    const seededVisit = await admin.from("appointments").insert({
      professional_id: seeded!.professionalId,
      clinic_id: link!.clinic_id,
      patient_name: "Hours Test Patient",
      patient_phone: "+35799000111",
      appointment_datetime: visitAt.toISOString(),
      status: "CONFIRMED",
      duration_minutes: 30,
    });
    expect(seededVisit.error).toBeNull();
    const links = async () => {
      const { data } = await admin
        .from("professional_clinics")
        .select(`id, slot_duration_minutes, ${weekday}`)
        .in("id", [seeded!.primaryId, seeded!.secondId]);
      return Object.fromEntries(
        ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => [String(row.id), row]),
      );
    };
    const toastText = (text: string) => page.locator("[data-sonner-toast]").getByText(text);

    await openSettings(page, seeded!, "clinics");
    const card = clinicCard(page, "Limassol Skin Clinic");
    await card.getByRole("button", { name: "Edit hours" }).click();
    // Closing the day of the visit: she is told before anything is saved.
    await card.getByTestId(`settings-clinic-day-${weekday}`).getByRole("checkbox").uncheck();
    await card.getByTestId("settings-clinic-hours-save").click();
    const warning = page.getByRole("dialog", { name: "You have visits outside these hours" });
    await expect(warning).toBeVisible({ timeout: 20_000 });
    const listed = warning.getByTestId("settings-hours-visits");
    await expect(listed).toContainText(
      "1 confirmed visit falls outside these hours. It stays in your agenda: changing your hours cancels nothing.",
    );
    await expect(listed).toContainText("Hours Test Patient");
    await expect(listed).toContainText("day closed");
    // "Go back" saves nothing.
    await warning.getByRole("button", { name: "Go back" }).click();
    await expect(warning).toBeHidden();
    expect((await links())[seeded!.primaryId]?.[weekday]).toBe(true);
    // Saving anyway keeps the visit.
    await card.getByTestId("settings-clinic-hours-save").click();
    await expect(warning).toBeVisible({ timeout: 20_000 });
    await warning.getByTestId("settings-hours-confirm").click();
    await expect(toastText("Hours saved for Limassol Skin Clinic.")).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await links())[seeded!.primaryId]?.[weekday], { timeout: 20_000 }).toBe(false);
    expect((await links())[seeded!.secondId]?.[weekday]).toBe(true);
    const { data: stillThere } = await admin
      .from("appointments")
      .select("status")
      .eq("professional_id", seeded!.professionalId);
    expect(stillThere).toEqual([{ status: "CONFIRMED" }]);

    // "Apply these hours to all my clinics": asks first, naming the other clinic.
    await card.getByRole("button", { name: "Edit hours" }).click();
    await card.getByTestId("settings-clinic-apply-week").click();
    const applyWeek = page.getByRole("dialog", { name: "Apply these hours to all your clinics?" });
    await expect(applyWeek).toContainText(
      "Paphos Medical Centre will get the same open days, hours and breaks as Limassol Skin Clinic.",
    );
    await applyWeek.getByRole("button", { name: "Apply to all 2 clinics" }).click();
    await expect(toastText("Hours applied to all 2 of your clinics.")).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await links())[seeded!.secondId]?.[weekday], { timeout: 20_000 }).toBe(false);
    // The slot length was not copied with the week.
    expect((await links())[seeded!.secondId]?.slot_duration_minutes).toBe(30);

    // "Apply this slot length to all my clinics".
    await card.getByRole("radio", { name: "45 min" }).click();
    await card.getByTestId("settings-clinic-apply-slot").click();
    const applySlot = page.getByRole("dialog", { name: "Apply this slot length to all your clinics?" });
    await expect(applySlot).toContainText("Paphos Medical Centre will use 45-minute slots like Limassol Skin Clinic.");
    await applySlot.getByRole("button", { name: "Apply to all 2 clinics" }).click();
    await expect(toastText("45-minute slots applied to all 2 of your clinics.")).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(
        async () => {
          const rows = await links();
          return [rows[seeded!.primaryId]?.slot_duration_minutes, rows[seeded!.secondId]?.slot_duration_minutes];
        },
        { timeout: 20_000 },
      )
      .toEqual([45, 45]);
    // Each real change is recorded for its clinic: two each (Limassol: the day, the
    // slot; Paphos: the copied week, the slot).
    const { data: recorded } = await admin
      .from("request_log")
      .select("details")
      .eq("professional_id", seeded!.professionalId)
      .eq("request_type", "professional_clinic_hours_change");
    const byClinic = (id: string) =>
      (recorded ?? []).filter((row) => (row.details as { link_id?: string }).link_id === id).length;
    expect([byClinic(seeded!.primaryId), byClinic(seeded!.secondId)]).toEqual([2, 2]);

    // The clinic row has visits: remove them so the cleanup can delete it.
    await admin.from("appointments").delete().eq("professional_id", seeded!.professionalId);
  });

  test("pausing a clinic that has visits asks first, and cancels nothing", async ({ page }) => {
    test.setTimeout(150_000);
    const { data: link } = await admin
      .from("professional_clinics")
      .select("clinic_id")
      .eq("id", seeded!.primaryId)
      .single();
    const visit = (daysAhead: number, status: string) => ({
      professional_id: seeded!.professionalId,
      clinic_id: link!.clinic_id,
      patient_name: `Pause Test ${daysAhead}`,
      patient_phone: "+35799000111",
      appointment_datetime: new Date(Date.now() + daysAhead * 86_400_000).toISOString(),
      status,
      duration_minutes: 30,
    });
    const seededVisits = await admin.from("appointments").insert([visit(3, "CONFIRMED"), visit(4, "REQUESTED")]);
    expect(seededVisits.error).toBeNull();

    await openSettings(page, seeded!, "clinics");
    const toggle = clinicCard(page, "Limassol Skin Clinic").getByRole("switch", { name: /Online booking/ });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    const dialog = page.getByRole("dialog", { name: "Pause online booking at Limassol Skin Clinic?" });
    // The first check of a run compiles its route on a dev server: allow for it.
    await expect(dialog).toBeVisible({ timeout: 45_000 });
    const listed = dialog.getByTestId("settings-clinic-pause-visits");
    await expect(listed).toContainText("1 confirmed visit at this clinic stays in your agenda.");
    await expect(listed).toContainText(
      "1 request at this clinic is waiting for your answer. You can still answer it.",
    );
    // "Keep it on" changes nothing.
    await dialog.getByRole("button", { name: "Keep it on" }).click();
    await expect(dialog).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await dialog.getByTestId("settings-clinic-pause-confirm").click();
    await expect(toggle).toHaveAttribute("aria-checked", "false", { timeout: 20_000 });
    const { data: paused } = await admin
      .from("professional_clinics")
      .select("pause_online_bookings")
      .eq("id", seeded!.primaryId)
      .single();
    expect(paused?.pause_online_bookings).toBe(true);
    const { data: kept } = await admin
      .from("appointments")
      .select("status")
      .eq("professional_id", seeded!.professionalId);
    expect((kept ?? []).map((row) => row.status).sort()).toEqual(["CONFIRMED", "REQUESTED"]);
    // Switching it back on asks nothing.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true", { timeout: 20_000 });
    await expect(dialog).toHaveCount(0);

    // The clinic row has visits: remove them so the cleanup can delete it.
    await admin.from("appointments").delete().eq("professional_id", seeded!.professionalId);
  });

  test("with her access ended, each clinic switch is off and says when it opens again", async ({ page }) => {
    test.setTimeout(120_000);
    const ended = await admin
      .from("professionals")
      .update({ pro_access_until: new Date(Date.now() - 86_400_000).toISOString() })
      .eq("id", seeded!.professionalId);
    expect(ended.error).toBeNull();
    await openSettings(page, seeded!, "clinics");
    await expect(page.getByTestId("settings-access-ended")).toBeVisible({ timeout: 20_000 });
    const card = clinicCard(page, "Limassol Skin Clinic");
    const toggle = card.getByRole("switch", { name: /Online booking/ });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(toggle).toBeDisabled();
    await expect(card.getByTestId("settings-clinic-switch-note")).toHaveText(
      "Opens again when your DocCy access is renewed.",
    );
    // The pause is not written into the clinic: renewing brings it back as she left it.
    const { data: link } = await admin
      .from("professional_clinics")
      .select("pause_online_bookings")
      .eq("id", seeded!.primaryId)
      .single();
    expect(link?.pause_online_bookings).toBe(false);

    // Said on the pages she opens every day too (user, 2026-10-12).
    await page.goto("/dashboard");
    const onDashboard = page.getByTestId("dashboard-access-ended");
    await expect(onDashboard).toContainText(
      "Your DocCy access has ended, so online bookings are switched off.",
      { timeout: 30_000 },
    );
    await expect(onDashboard).toContainText("You can still answer the requests and handle the visits you already have.");
    await expect(onDashboard.getByRole("link", { name: "See your plan" })).toHaveAttribute(
      "href",
      "/settings?section=plan",
    );
    await page.goto("/agenda");
    await expect(page.getByTestId("agenda-access-ended")).toContainText(
      "Your DocCy access has ended: no new bookings, online or manual.",
      { timeout: 30_000 },
    );
  });

  test("holiday mode: dates checked, visits warned about, recorded, announced in the agenda", async ({ page }) => {
    test.setTimeout(180_000);
    // A day in Cyprus, as stored and as she types it.
    const cyDay = (daysAhead: number) => {
      const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Nicosia" }).format(
        new Date(Date.now() + daysAhead * 86_400_000),
      );
      const [year, month, day] = iso.split("-");
      return { iso, shown: `${day}/${month}/${year}` };
    };
    const { data: link } = await admin
      .from("professional_clinics")
      .select("clinic_id")
      .eq("id", seeded!.primaryId)
      .single();
    const visit = (daysAhead: number, status: string) => ({
      professional_id: seeded!.professionalId,
      clinic_id: link!.clinic_id,
      patient_name: `Holiday Test ${daysAhead}`,
      patient_phone: "+35799000111",
      appointment_datetime: new Date(Date.now() + daysAhead * 86_400_000).toISOString(),
      status,
      duration_minutes: 30,
    });
    // One confirmed visit and one open request inside the holiday, one visit after it.
    const seededVisits = await admin
      .from("appointments")
      .insert([visit(4, "CONFIRMED"), visit(5, "REQUESTED"), visit(9, "CONFIRMED")]);
    expect(seededVisits.error).toBeNull();
    const changes = async () =>
      (
        await admin
          .from("request_log")
          .select("status, details, before_snapshot")
          .eq("professional_id", seeded!.professionalId)
          .eq("request_type", "professional_holiday_change")
          .order("created_at", { ascending: true })
      ).data ?? [];
    const toastText = (text: string) => page.locator("[data-sonner-toast]").getByText(text);

    await openSettings(page, seeded!, "clinics");
    const sidebar = page.getByTestId("settings-sidebar");
    const toggle = sidebar.getByRole("switch", { name: "Holiday mode" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("settings-holiday-banner")).toHaveCount(0);
    await toggle.click();
    const from = sidebar.getByLabel("From");
    const to = sidebar.getByLabel("To");
    const save = sidebar.getByTestId("settings-holiday-save");

    // It cannot start in the past, nor end before it starts.
    await from.fill(cyDay(-1).shown);
    await to.fill(cyDay(6).shown);
    await save.click();
    await expect(toastText("The holiday cannot start in the past.")).toBeVisible({ timeout: 20_000 });
    await from.fill(cyDay(6).shown);
    await to.fill(cyDay(3).shown);
    await save.click();
    await expect(toastText("The holiday must end on or after the day it starts.")).toBeVisible({ timeout: 20_000 });
    expect(await changes()).toHaveLength(0);

    // Good dates with visits inside: she is told first, and nothing is cancelled.
    const start = cyDay(3);
    const end = cyDay(6);
    await from.fill(start.shown);
    await to.fill(end.shown);
    await save.click();
    const dialog = page.getByRole("dialog", { name: "You have visits in these dates" });
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    const visits = dialog.getByTestId("settings-holiday-visits");
    await expect(visits).toContainText(
      "1 confirmed visit falls in these dates. It stays in your agenda: holiday mode cancels nothing.",
    );
    await expect(visits).toContainText("1 request in these dates is waiting for your answer.");
    await expect(visits).toContainText("Holiday Test 4");
    await expect(visits).toContainText("Holiday Test 5");
    await expect(visits).not.toContainText("Holiday Test 9");
    expect(await changes()).toHaveLength(0);
    await dialog.getByTestId("settings-holiday-confirm").click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    // Announced before it starts, in Settings and in the agenda.
    const announced = `Holiday mode starts on ${start.shown} and runs until ${end.shown}. Patients cannot book online for those days.`;
    await expect(page.getByTestId("settings-holiday-banner")).toHaveText(announced, { timeout: 20_000 });
    await expect.poll(async () => (await changes()).length, { timeout: 20_000 }).toBe(1);
    const on = (await changes())[0];
    expect(on.status).toBe("recorded");
    expect(on.details).toMatchObject({ enabled: true, start_date: start.iso, end_date: end.iso });
    expect(on.before_snapshot).toMatchObject({ enabled: false });
    const { data: settingsRow } = await admin
      .from("professional_settings")
      .select("holiday_mode_enabled, holiday_start_date, holiday_end_date")
      .eq("professional_id", seeded!.professionalId)
      .single();
    expect(settingsRow).toEqual({
      holiday_mode_enabled: true,
      holiday_start_date: start.iso,
      holiday_end_date: end.iso,
    });
    const { data: kept } = await admin
      .from("appointments")
      .select("status")
      .eq("professional_id", seeded!.professionalId);
    expect((kept ?? []).map((row) => row.status).sort()).toEqual(["CONFIRMED", "CONFIRMED", "REQUESTED"]);

    await page.goto("/agenda");
    await expect(page.getByTestId("agenda-holiday-banner")).toContainText(announced, { timeout: 30_000 });
    // Its days are marked in the agenda, and the day after it is not.
    await page.goto(`/agenda?view=month&date=${start.iso}`);
    await expect(page.getByTestId(`agenda-month-day-${start.iso}`)).toHaveAttribute("data-holiday", "true", {
      timeout: 30_000,
    });
    // The month fits the window: the page does not scroll.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight), { timeout: 20_000 })
      .toBeLessThanOrEqual(0);
    // (Another month may hold the day after: opened on its own.)
    await page.goto(`/agenda?view=month&date=${cyDay(7).iso}`);
    await expect(page.getByTestId(`agenda-month-day-${cyDay(7).iso}`)).toHaveAttribute("data-holiday", "false", {
      timeout: 30_000,
    });

    // Switching it off is recorded too, with the dates it had.
    await page.goto("/settings?section=clinics");
    const toggleAgain = page.getByTestId("settings-sidebar").getByRole("switch", { name: "Holiday mode" });
    await expect(toggleAgain).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });
    await toggleAgain.click();
    await expect(toastText("Holiday mode is off.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("settings-holiday-banner")).toHaveCount(0);
    await expect.poll(async () => (await changes()).length, { timeout: 20_000 }).toBe(2);
    const off = (await changes())[1];
    expect(off.details).toMatchObject({ enabled: false });
    expect(off.before_snapshot).toMatchObject({ enabled: true, start_date: start.iso, end_date: end.iso });

    // The clinic row has visits: remove them so the cleanup can delete it.
    await admin.from("appointments").delete().eq("professional_id", seeded!.professionalId);
  });

  test("a holiday that has ended shows as off, and one that runs keeps its start", async ({ page }) => {
    test.setTimeout(150_000);
    const cyDay = (daysAhead: number) => {
      const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Nicosia" }).format(
        new Date(Date.now() + daysAhead * 86_400_000),
      );
      const [year, month, day] = iso.split("-");
      return { iso, shown: `${day}/${month}/${year}` };
    };
    const setHoliday = async (startDays: number, endDays: number) => {
      const { error } = await admin.from("professional_settings").upsert(
        {
          professional_id: seeded!.professionalId,
          holiday_mode_enabled: true,
          holiday_start_date: cyDay(startDays).iso,
          holiday_end_date: cyDay(endDays).iso,
        },
        { onConflict: "professional_id" },
      );
      expect(error).toBeNull();
    };

    // Ended three days ago: the switch is off and nothing is announced.
    await setHoliday(-8, -3);
    await openSettings(page, seeded!, "clinics");
    const sidebar = page.getByTestId("settings-sidebar");
    await expect(sidebar.getByRole("switch", { name: "Holiday mode" })).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("settings-holiday-banner")).toHaveCount(0);

    // Running since two days ago: it says so with both dates, and its end can move.
    await setHoliday(-2, 2);
    await page.reload();
    await expect(page.getByTestId("settings-holiday-banner")).toHaveText(
      `Holiday mode is on from ${cyDay(-2).shown} until ${cyDay(2).shown}. Patients cannot book online for those days.`,
      { timeout: 30_000 },
    );
    await page.getByTestId("settings-sidebar").getByLabel("To").fill(cyDay(4).shown);
    await page.getByTestId("settings-sidebar").getByTestId("settings-holiday-save").click();
    await expect(page.getByTestId("settings-holiday-banner")).toContainText(`until ${cyDay(4).shown}`, {
      timeout: 20_000,
    });
    const { data: row } = await admin
      .from("professional_settings")
      .select("holiday_start_date, holiday_end_date")
      .eq("professional_id", seeded!.professionalId)
      .single();
    expect(row).toEqual({ holiday_start_date: cyDay(-2).iso, holiday_end_date: cyDay(4).iso });
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
    await expect(page.getByRole("heading", { level: 1, name: "Clinics" })).toBeVisible({ timeout: 20_000 });
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

  test("a setting changed too often is refused, and she is told when it opens again", async ({ page }) => {
    test.setTimeout(120_000);
    // 20 GeSY changes already today (the limit, request_types): the next one is refused.
    const { data: pro } = await admin
      .from("professionals")
      .select("is_gesy")
      .eq("id", seeded!.professionalId)
      .single();
    const before = Boolean(pro?.is_gesy);
    // A minute ago, on both stamps: a record is never decided before it is created.
    const madeAt = new Date(Date.now() - 60_000).toISOString();
    const filled = await admin.from("request_log").insert(
      Array.from({ length: 20 }, () => ({
        request_type: "professional_gesy_change",
        status: "recorded",
        details: { is_gesy: before },
        details_version: 1,
        before_snapshot: { is_gesy: !before },
        professional_id: seeded!.professionalId,
        requester_name: "Limit Test",
        requester_email: seeded!.email,
        created_at: madeAt,
        decided_at: madeAt,
      })),
    );
    expect(filled.error).toBeNull();
    const recorded = async () =>
      (
        await admin
          .from("request_log")
          .select("id", { count: "exact", head: true })
          .eq("professional_id", seeded!.professionalId)
          .eq("request_type", "professional_gesy_change")
      ).count;
    const countBefore = await recorded();

    await openSettings(page, seeded!, "profile");
    const gesy = page.getByRole("switch", { name: "I see GeSY patients" });
    await expect(gesy).toHaveAttribute("aria-checked", String(before), { timeout: 20_000 });
    await expect(async () => {
      await gesy.click();
      await expect(
        page.getByText(
          /You have reached the limit for this change\. You can make it again on \d{2}\/\d{2}\/\d{4} at \d{2}:\d{2}\. If it is urgent, contact us\./,
        ),
      ).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    // Nothing changed and nothing was recorded.
    await expect(gesy).toHaveAttribute("aria-checked", String(before));
    const { data: after } = await admin
      .from("professionals")
      .select("is_gesy")
      .eq("id", seeded!.professionalId)
      .single();
    expect(Boolean(after?.is_gesy)).toBe(before);
    expect(await recorded()).toBe(countBefore);
  });

  test("Account: one sign-in & security card with the signed-in email", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "account");
    const card = page.getByTestId("settings-account-security");
    await expect(card.getByRole("heading", { name: "Sign-in & security" })).toBeVisible();
    await expect(page.getByTestId("settings-account-email")).toHaveText(seeded!.email);
    await expect(page.getByTestId("settings-account-email-row")).toContainText(
      "You sign in with it, and booking requests are sent here.",
    );
    await expect(card.getByRole("button", { name: "Change password" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Sign out other devices" })).toBeVisible();
    await expect(card.getByTestId("settings-sign-out-button")).toBeVisible();
  });

  test("Account: a new email waits for its link, survives a reload, and can be cancelled", async ({ page }) => {
    test.setTimeout(180_000);
    await openSettings(page, seeded!, "account");
    const row = page.getByTestId("settings-account-email-row");
    const result = page.getByTestId("settings-account-email-result");
    const pending = page.getByTestId("settings-account-email-pending");
    const newEmail = `settings-new-${seeded!.nonce}@integration.test`;
    const waiting = () =>
      admin
        .from("professional_email_changes")
        .select("new_email, confirmed_at, cancelled_at")
        .eq("professional_id", seeded!.professionalId)
        .is("confirmed_at", null)
        .is("cancelled_at", null);

    await expect(async () => {
      if (!(await row.getByLabel("New email").isVisible())) {
        await row.getByRole("button", { name: "Change email" }).click({ timeout: 2_000 });
      }
      await expect(row.getByLabel("New email")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    const input = row.getByLabel("New email");

    await expect(row).toContainText(
      "We send a link to the new address. Nothing changes until you confirm it; then you are signed out on all devices and sign in with the new email.",
    );
    await input.fill(seeded!.email.toUpperCase());
    await row.getByRole("button", { name: "Send confirmation link" }).click();
    await expect(result).toHaveText("That's already your email.");

    // An address another account uses is refused.
    const other = await seed(admin, "taken");
    try {
      await input.fill(other.email);
      await input.press("Enter");
      await expect(result).toHaveText("That email already has a DocCy account.", { timeout: 20_000 });
    } finally {
      await cleanup(admin, other);
    }

    // A free address: the link is sent, and nothing changes until it is opened.
    await input.fill(newEmail.toUpperCase());
    await input.press("Enter");
    await expect(result).toContainText(`Check ${newEmail}: open the link we sent`, { timeout: 20_000 });
    await expect(pending).toContainText(`Waiting for you to confirm ${newEmail}.`);
    await expect(page.getByTestId("settings-account-email")).toHaveText(seeded!.email);
    expect((await waiting()).data).toEqual([{ new_email: newEmail, confirmed_at: null, cancelled_at: null }]);
    const unchanged = await admin
      .from("professionals")
      .select("registration_email")
      .eq("id", seeded!.professionalId)
      .single();
    expect(unchanged.data?.registration_email).toBe(seeded!.email);

    // The waiting change is still shown after a reload, and she can cancel it.
    await page.reload();
    await expect(pending).toContainText(`Waiting for you to confirm ${newEmail}.`, { timeout: 30_000 });
    await expect(async () => {
      await pending.getByRole("button", { name: "Cancel" }).click({ timeout: 2_000 });
      await expect(pending).toHaveCount(0, { timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    expect((await waiting()).data).toEqual([]);
    await page.reload();
    await expect(page.getByTestId("settings-account-security")).toBeVisible({ timeout: 30_000 });
    await expect(pending).toHaveCount(0);
  });

  test("Account: the emailed link changes the sign-in email and where bookings go, once", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    const newEmail = `settings-new-${seeded!.nonce}@integration.test`;
    // The link only travels by email (never sent to test addresses), so the test makes
    // the waiting change the way the server does: a token, and its hash in the database.
    const token = randomBytes(32).toString("base64url");
    const started = await admin.rpc("professional_email_change_start", {
      p_professional_id: seeded!.professionalId,
      p_new_email: newEmail,
      p_token_hash: createHash("sha256").update(token).digest("hex"),
    });
    expect(started.error).toBeNull();

    // She is signed in on this device, and opens the link on another where she is not.
    await openSettings(page, seeded!, "account");
    const context = await browser.newContext();
    const link = await context.newPage();
    try {
      await link.goto(`/account/confirm-email?token=${token}`);
      const card = link.getByTestId("confirm-email");
      await expect(card).toContainText(newEmail, { timeout: 30_000 });

      // Opening the link changed nothing.
      const before = await admin.auth.admin.getUserById(seeded!.authUserId);
      expect(before.data.user?.email).toBe(seeded!.email);

      await expect(async () => {
        if (await card.isVisible()) await card.getByRole("button", { name: "Confirm new email" }).click({ timeout: 2_000 });
        await expect(link.getByTestId("confirm-email-done")).toBeVisible({ timeout: 10_000 });
      }).toPass({ timeout: 40_000 });
      await expect(link.getByTestId("confirm-email-done")).toContainText(
        `Your DocCy account now uses ${newEmail}, and booking requests are sent there. You have been signed out on every device`,
      );
      await expect(link.getByTestId("confirm-email-done").getByRole("link", { name: "Sign in" })).toHaveAttribute(
        "href",
        "/login",
      );

      const after = await admin.auth.admin.getUserById(seeded!.authUserId);
      expect(after.data.user?.email).toBe(newEmail);
      const professional = await admin
        .from("professionals")
        .select("registration_email")
        .eq("id", seeded!.professionalId)
        .single();
      expect(professional.data?.registration_email).toBe(newEmail);
      const log = await admin
        .from("request_log")
        .select("status, details, before_snapshot")
        .eq("professional_id", seeded!.professionalId)
        .eq("request_type", "professional_email_change");
      expect(log.data).toEqual([
        {
          status: "recorded",
          details: { registration_email: newEmail },
          before_snapshot: { registration_email: seeded!.email },
        },
      ]);

      // The link works once.
      await link.goto(`/account/confirm-email?token=${token}`);
      await expect(link.getByTestId("confirm-email-gone")).toContainText("This link no longer works", {
        timeout: 30_000,
      });
    } finally {
      await context.close();
    }

    // The device that was signed in is signed out: she signs in again with the new address.
    await page.goto("/settings?section=account");
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });

    // Settings then shows the new address, with nothing left waiting.
    await openSettings(page, { ...seeded!, email: newEmail }, "account");
    await expect(page.getByTestId("settings-account-email")).toHaveText(newEmail);
    await expect(page.getByTestId("settings-account-email-pending")).toHaveCount(0);
  });

  test("Account: a new password signs out her other devices", async ({ page, playwright }) => {
    test.setTimeout(120_000);
    // Signed out: nothing to do.
    const anonymous = await playwright.request.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
    expect((await anonymous.post("/api/auth/password-changed")).status()).toBe(401);
    await anonymous.dispose();

    // The "Choose a new password" page calls this once the password is saved.
    await openSettings(page, seeded!, "account");
    const before = Date.now();
    const res = await page.request.post("/api/auth/password-changed");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true, othersSignedOut: true });

    // Sessions made before now stop working, except this one.
    const row = await admin
      .from("professionals")
      .select("auth_session_revoked_after, auth_keep_session_id")
      .eq("id", seeded!.professionalId)
      .single();
    expect(Date.parse(String(row.data?.auth_session_revoked_after))).toBeGreaterThan(before - 5_000);
    expect(String(row.data?.auth_keep_session_id ?? "")).toMatch(/^[0-9a-f-]{36}$/);

    // This device stays signed in.
    await page.reload();
    await expect(page.getByTestId("settings-account-security")).toBeVisible({ timeout: 30_000 });
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

  test("Promote: language of the sign and scripts, sharing, and a notice when patients cannot book", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await openSettings(page, seeded!, "promote");

    // One clinic takes online bookings, so nothing warns her.
    await expect(page.getByTestId("promote-booking-notice")).toHaveCount(0);

    // The voicemail names her and the site; the reception script is spoken by her team.
    const voicemail = page.getByTestId("promote-voicemail-script");
    const reception = page.getByTestId("promote-reception-script");
    await expect(async () => {
      if (!(await voicemail.locator("textarea").isVisible())) {
        await voicemail.getByText("Voicemail message").click({ timeout: 2_000 });
      }
      await expect(voicemail.locator("textarea")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(voicemail.locator("textarea")).toHaveValue(/search for Settings B1 ui [\d-]+ on [^/\s]+\. Thank you\.$/);
    await reception.getByText("Reception script").click();
    await expect(reception.locator("textarea")).toHaveValue(/you can see Settings B1 ui [\d-]+'s available times/);

    // She picks Greek for her patients: the scripts follow, the tab stays as it is.
    const language = page.getByTestId("promote-language");
    await expect(language.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    await language.getByRole("button", { name: "Ελληνικά" }).click();
    await expect(language.getByRole("button", { name: "Ελληνικά" })).toHaveAttribute("aria-pressed", "true");
    await expect(voicemail.locator("textarea")).toHaveValue(/αναζητήστε «Settings B1 ui [\d-]+»/);
    await expect(page.getByRole("button", { name: "Print booking sign" })).toBeVisible();

    // Sharing opens WhatsApp or Viber with her name and link, in the chosen language.
    const share = page.getByTestId("promote-share");
    const whatsapp = await share.getByRole("link", { name: "WhatsApp" }).getAttribute("href");
    expect(whatsapp).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(decodeURIComponent(String(whatsapp))).toMatch(/Κλείστε ραντεβού online με Settings B1 ui [\d-]+: http.*\/settings-b1-ui-/);
    expect(await share.getByRole("link", { name: "Viber" }).getAttribute("href")).toMatch(/^viber:\/\/forward\?text=/);

    expect(await share.getByRole("link", { name: "Telegram" }).getAttribute("href")).toMatch(
      /^https:\/\/t\.me\/share\/url\?url=http.*settings-b1-ui-.*&text=/,
    );

    // The choice is remembered in this browser.
    await page.reload();
    await expect(language.getByRole("button", { name: "Ελληνικά" })).toHaveAttribute("aria-pressed", "true", {
      timeout: 30_000,
    });

    // With several specialties she ticks the ones the sign shows; all of them at first.
    const onSign = page.getByTestId("promote-sign-specialties");
    await expect(onSign.getByRole("checkbox", { name: "Dermatology" })).toBeChecked();
    await expect(onSign.getByRole("checkbox", { name: "Venereology" })).toBeChecked();
    await page.getByRole("button", { name: "Print booking sign" }).click();
    const sign = page.frameLocator('iframe[title="DocCy booking sign"]').last();
    await expect(sign.locator(".who")).toHaveText(/^Settings B1 ui [\d-]+$/, { timeout: 20_000 });
    await expect(sign.locator(".specialties")).toHaveText("Dermatology · Venereology");

    await onSign.getByRole("checkbox", { name: "Dermatology" }).uncheck();
    await page.getByRole("button", { name: "Print booking sign" }).click();
    await expect(sign.locator(".who")).toHaveText(/^Settings B1 ui [\d-]+ · Venereology$/, { timeout: 20_000 });

    // Remembered in this browser, like the language.
    await page.reload();
    await expect(onSign.getByRole("checkbox", { name: "Dermatology" })).not.toBeChecked({ timeout: 30_000 });
    await expect(onSign.getByRole("checkbox", { name: "Venereology" })).toBeChecked();

    // DocCy no longer offers to add the button to her website.
    await page.getByTestId("promote-website-script").getByText("Website booking button").click();
    await expect(page.getByTestId("promote-website-script")).toContainText("Κράτηση online");
    await expect(page.getByRole("button", { name: "Contact Support" })).toHaveCount(0);
    await expect(page.getByText("Want us to add it for you?")).toHaveCount(0);

    // Every clinic paused: patients who scan the sign cannot book, and the tab says so.
    const paused = await admin
      .from("professional_clinics")
      .update({ pause_online_bookings: true })
      .eq("professional_id", seeded!.professionalId);
    expect(paused.error).toBeNull();
    await page.reload();
    const notice = page.getByTestId("promote-booking-notice");
    await expect(notice).toContainText("Online booking is paused at every clinic", { timeout: 30_000 });
    await expect(async () => {
      await notice.getByRole("link", { name: "Open Clinics" }).click({ timeout: 2_000 });
      await expect(page).toHaveURL(/section=clinics/, { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
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

      // 5. Three requests in 30 days is the limit (request_types), withdrawn and denied ones
      //    included: a fourth is refused, and she is told when she can send another.
      const fourth = await page.request.post("/api/specialty-requests", {
        data: { toSpecialty: custom, toSpecialtyFromMaster: false, licenseNumber: "CY-NEW-1" },
      });
      expect(fourth.status(), await fourth.text()).toBe(429);
      expect((await fourth.json()).message).toContain("You have reached the limit for this change.");
      expect(await requests()).toHaveLength(3);
    } finally {
      await admin.from("professional_specialties").delete().eq("professional_id", seeded!.professionalId).eq("specialty", custom);
      await admin.from("specialties").delete().eq("name", custom);
    }
  });

  test("a specialty that is not in the catalogue joins it when a founder approves it", async ({ page, request }) => {
    test.setTimeout(180_000);
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

    await openSettings(page, seeded!, "profile");
    try {
      const customRequest = await page.request.post("/api/specialty-requests", {
        data: { toSpecialty: custom, toSpecialtyFromMaster: false, licenseNumber: "CY-NEW-1" },
      });
      expect(customRequest.status(), await customRequest.text()).toBe(201);
      const rows = await requests();
      expect(rows[0]!.details).toMatchObject({ name: custom, from_catalogue: false, license_number: "CY-NEW-1" });
      const approve = await request.post(`/api/internal/profile-changes/${rows[0]!.id}/approve`, { headers, data: {} });
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
