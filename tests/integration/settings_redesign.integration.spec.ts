import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signInDoctorAndSetCookies } from "../helpers/doctorAuth";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";

/**
 * Settings redesign (design B1): a sidebar of sections, one card per clinic, removal
 * down to one clinic and one specialty, and clinic details changed by request only.
 *
 * Removing a specialty or a clinic, asking for a clinic and requesting a clinic change
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
      district: "Limassol",
      registration_email: email,
      email,
      mobile_number: "+35799123456",
      languages: ["English"],
      status: "verified",
      slug: `settings-b1-${tag}-${n}`,
      is_registered: true,
      pro_access_until: new Date(Date.now() + 180 * 86_400_000).toISOString(),
      finder_visible: false,
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
      is_approved: true,
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
    await admin
      .from("professional_specialty_change_requests")
      .delete()
      .eq("professional_id", seeded.professionalId);
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

    await expect(page.getByRole("heading", { level: 1, name: "Availability" })).toBeVisible();

    const sidebar = page.getByTestId("settings-sidebar");
    await sidebar.getByRole("link", { name: /Clinics/ }).click();
    await expect(page).toHaveURL(/section=clinics/);
    await expect(page.getByRole("heading", { level: 1, name: "Clinics" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Clinics/ })).toHaveAttribute("aria-current", "page");

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Clinics" })).toBeVisible();

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

  test("a clinic can be removed until one is left", async ({ page }) => {
    test.setTimeout(120_000);
    let removed = "";
    await page.route("**/api/professional-clinics?*", async (route) => {
      if (route.request().method() !== "DELETE") return route.fallback();
      removed = new URL(route.request().url()).searchParams.get("locationId") ?? "";
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await openSettings(page, seeded!, "clinics");

    await clinicCard(page, "Paphos Medical Centre").getByRole("button", { name: "Remove clinic" }).click();
    const dialog = page.getByRole("dialog", { name: /Remove Paphos Medical Centre/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Remove clinic" }).click();

    await expect(page.getByTestId("settings-clinic-card")).toHaveCount(1);
    const last = clinicCard(page, "Limassol Skin Clinic");
    await expect(last.getByRole("button", { name: "Remove clinic" })).toHaveCount(0);
    await expect(last).toContainText("Your profile needs at least one clinic.");
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
    await card.getByRole("button", { name: "Request a change" }).click();

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

    await card.getByRole("button", { name: "Edit hours" }).click();
    await expect(page.getByTestId("settings-clinic-name-note")).toContainText("Request a change");
    await expect(page.locator("#clinicName")).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Request a change" })).toBeVisible();
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

  test("booking limits save the moment they change, leaving a half-edited bio alone", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "profile");
    await page.locator("#settings-bio").fill("A bio I have not saved");
    await expect(page.getByTestId("settings-bio-save")).toBeVisible();

    await page.getByTestId("settings-sidebar").getByRole("link", { name: /Availability/ }).click();
    // Clinic switches live on the clinic cards only.
    await expect(page.getByTestId("settings-availability-clinics").getByRole("switch")).toHaveCount(0);
    await page.locator("#minimumNoticeHours").selectOption("48");
    await expect(page.locator("[data-sonner-toast]").getByText("Booking limits saved.")).toBeVisible();

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
    await expect(page.getByText(/coming soon/i)).toHaveCount(0);
  });

  test("Profile and Services link to the public profile", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "profile");
    // Profile and Services each have one; only the open section's is visible.
    const preview = page.locator('[data-testid="settings-preview-profile"]:visible');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("href", /^\/[a-z]{2}\/[^/]+$/);
    await expect(preview).toHaveAttribute("target", "_blank");
  });

  test("a section that fits the window does not scroll", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1632, height: 862 });
    await openSettings(page, seeded!);
    await expect(page.getByRole("heading", { level: 1, name: "Availability" })).toBeVisible();
    await expect(page.getByTestId("auth-about-footer")).toBeAttached();
    // Header + page + "About DocCy" footer used to add up to more than the window.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    expect(overflow).toBeLessThanOrEqual(0);
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

  test("specialties can be removed until one is left", async ({ page }) => {
    test.setTimeout(120_000);
    let sent: unknown = null;
    await page.route("**/api/doctor-specialties", async (route) => {
      if (route.request().method() !== "DELETE") return route.fallback();
      sent = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ specialties: ["Dermatology"] }),
      });
    });
    await openSettings(page, seeded!, "profile");

    const specialties = page.getByTestId("settings-specialties");
    await specialties.getByRole("button", { name: "Remove Venereology" }).click();
    await page.getByRole("dialog", { name: /Remove Venereology/ }).getByRole("button", { name: "Remove" }).click();

    await expect(specialties).not.toContainText("Venereology");
    await expect(specialties.getByRole("button", { name: /^Remove / })).toHaveCount(0);
    await expect(specialties).toContainText("Your profile needs at least one specialty.");
    expect(sent).toEqual({ specialty: "Venereology" });
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

  test("adding a specialty: errors by each field, then an in-review chip that can be cancelled", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    // Cancelling is a new endpoint (DELETE, docs/handoff/settings-redesign.md): stubbed here.
    let cancelMethod: string | null = null;
    await page.route("**/api/doctor-specialty-change-request", async (route) => {
      if (route.request().method() !== "DELETE") return route.fallback();
      cancelMethod = route.request().method();
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await openSettings(page, seeded!, "profile");

    const specialties = page.getByTestId("settings-specialties");
    // One action only: no "what do you want to do?" choice.
    await specialties.getByRole("button", { name: "+ Add a specialty" }).click();
    const form = page.getByTestId("settings-specialty-change-form");
    await expect(form.locator("select")).toHaveCount(0);
    await expect(form).toContainText("So DocCy can check you're registered for this specialty.");

    // Both errors at once, next to their fields.
    await page.getByTestId("settings-specialty-change-submit").click();
    await expect(page.getByTestId("settings-specialty-error")).toHaveText("Choose the specialty you want to add.");
    await expect(form).toContainText("Enter your license or certification number.");

    await page.getByTestId("settings-specialty-change-trigger").click();
    await form.getByRole("button", { name: "Gastroenterology", exact: true }).click();
    await expect(page.getByTestId("settings-specialty-error")).toHaveCount(0);
    await page.getByLabel("License / certification number").fill("CY-E2E-1");
    await page.getByTestId("settings-specialty-change-submit").click();

    // The real request endpoint stores it; the page shows it as a chip in review.
    const chip = page.getByTestId("settings-specialty-change-pending");
    await expect(chip).toContainText("Gastroenterology");
    await expect(chip).toContainText("In review");
    await expect(specialties.getByRole("button", { name: "+ Add a specialty" })).toHaveCount(0);
    const stored = await admin
      .from("professional_specialty_change_requests")
      .select("request_kind, to_specialty, license_number, status")
      .eq("professional_id", seeded!.professionalId)
      .single();
    expect(stored.data).toEqual({
      request_kind: "add",
      to_specialty: "Gastroenterology",
      license_number: "CY-E2E-1",
      status: "pending",
    });

    await chip.getByRole("button", { name: "Cancel the request for Gastroenterology" }).click();
    await expect(chip).toHaveCount(0);
    expect(cancelMethod).toBe("DELETE");
    await expect(specialties.getByRole("button", { name: "+ Add a specialty" })).toBeVisible();
  });
});
