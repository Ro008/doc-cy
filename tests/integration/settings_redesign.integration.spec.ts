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

  const primary = await admin
    .from("doctor_locations")
    .update({
      label: "Limassol Skin Clinic",
      clinic_address: `Settings Street ${n}, Limassol, Cyprus`,
      district: "Limassol",
      town: "Limassol",
      latitude: 34.68,
      longitude: 33.04,
      clinic_place_id: `settings-b1-primary-${n}`,
      pause_online_bookings: false,
    })
    .eq("doctor_id", professionalId)
    .eq("is_primary", true)
    .select("id")
    .single();
  if (primary.error || !primary.data?.id) throw new Error(`primary: ${primary.error?.message}`);

  const second = await admin
    .from("doctor_locations")
    .insert({
      doctor_id: professionalId,
      is_primary: false,
      sort_order: 1,
      label: "Paphos Medical Centre",
      clinic_address: `Settings Avenue ${n}, Paphos, Cyprus`,
      district: "Paphos",
      town: "Paphos",
      latitude: 34.77,
      longitude: 32.42,
      clinic_place_id: `settings-b1-second-${n}`,
      pause_online_bookings: true,
    })
    .select("id")
    .single();
  if (second.error || !second.data?.id) throw new Error(`second clinic: ${second.error?.message}`);

  return {
    professionalId,
    authUserId: auth.data.user.id,
    email,
    password: PASSWORD,
    primaryId: String(primary.data.id),
    secondId: String(second.data.id),
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

  test("unsaved changes say where they are and can be discarded", async ({ page }) => {
    test.setTimeout(120_000);
    await openSettings(page, seeded!, "clinics");
    // Nothing touched: no save bar.
    await expect(page.getByTestId("settings-clinic-card")).toHaveCount(2);
    await expect(page.getByTestId("settings-unsaved-changes")).toHaveCount(0);

    const card = clinicCard(page, "Limassol Skin Clinic");
    await card.getByRole("button", { name: "Edit name and hours" }).click();
    await page.locator("#clinicName").fill("Limassol Skin Care");

    const bar = page.getByTestId("settings-unsaved-changes");
    await expect(bar).toContainText("Unsaved changes in Clinics.");
    await expect(
      page.getByTestId("settings-sidebar").getByRole("link", { name: /Clinics/ }).getByLabel("Unsaved changes"),
    ).toBeVisible();

    await bar.getByRole("button", { name: "Discard changes" }).click();
    await expect(bar).toHaveCount(0, { timeout: 20_000 });
    await expect(clinicCard(page, "Limassol Skin Clinic")).toBeVisible();
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
});
