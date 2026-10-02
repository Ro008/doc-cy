import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { REGISTER_AVATAR_FIXTURE, uniqueRegisterTestMobile } from "./helpers/goto-register-practice-step";
import { createTestDoctor, deleteTestDoctor, loginDoctorUi, type TestDoctorFixture } from "./helpers/test-doctor";

/**
 * The top-right menu for accounts the founders haven't approved (user, 2026-09-28):
 * - an applicant (waiting, denied, withdrawn, or a draft still waiting for the
 *   confirmation link) sees only Support and Log out, and the photo they uploaded;
 * - an account with no profile and no application isn't kept signed in: it sees the
 *   message with "Join as a professional" and "Back to the finder";
 * - a professional keeps the full menu.
 */

const PASSWORD = "StrongPass123!";

async function openDesktopMenu(page: Page) {
  const toggle = page.getByTestId("userbar-toggle");
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  await toggle.click();
  const menu = page.getByTestId("userbar-menu");
  await expect(menu).toBeVisible();
  return menu;
}

test.describe("Integration: menu for accounts not yet approved", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial", retries: 0 });

  let admin: SupabaseClient;
  let applicantEmail: string;
  let applicantLogin: string;
  const lastName = `Menu ${Date.now().toString(36).replace(/\d/g, (d) => "abcdefghij"[Number(d)]!)}`;

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    // A confirmed applicant with a pending request and an uploaded photo.
    applicantEmail = `menu-${Date.now()}@integration.test`;
    const created = await admin.auth.admin.createUser({ email: applicantEmail, password: PASSWORD, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(`login: ${created.error?.message}`);
    applicantLogin = created.data.user.id;
    const photoPath = `professional_registration/${applicantLogin}/photo-seed.jpg`;
    await admin.storage
      .from("request-uploads")
      .upload(photoPath, fs.readFileSync(REGISTER_AVATAR_FIXTURE), { contentType: "image/jpeg" });
    const { data: clinic } = await admin
      .from("clinics")
      .select("id, address, district")
      .eq("is_archived", false)
      .not("address", "is", null)
      .limit(1)
      .single();
    const draft = await admin.rpc("request_draft_submit", {
      p_request_type: "professional_registration",
      p_auth_user_id: applicantLogin,
      p_details: {
        first_name: "Menu",
        last_name: lastName,
        gender: "female",
        gesy: true,
        email: applicantEmail,
        mobile: uniqueRegisterTestMobile(),
        languages: ["English"],
        photo: { bucket: "request-uploads", path: photoPath },
        specialties: [{ name: "Cardiology", from_catalogue: true, license_number: "MENU-1" }],
        clinics: [
          {
            clinic_id: clinic!.id,
            name: null,
            address: clinic!.address,
            district: clinic!.district,
            town: null,
            latitude: 35.1,
            longitude: 33.3,
            place_id: null,
            phone: null,
          },
        ],
        claimed_professional_id: null,
        disclaimer_accepted: true,
      },
      p_details_version: 1,
      p_requester_name: `Menu ${lastName}`,
      p_requester_email: applicantEmail,
    });
    if (draft.error) throw new Error(`draft: ${draft.error.message}`);
    const confirmed = await admin.rpc("request_draft_confirm", { p_auth_user_id: applicantLogin });
    if (confirmed.error) throw new Error(`confirm: ${confirmed.error.message}`);
  });

  test.afterAll(async () => {
    const { data: uploads } = await admin.storage.from("request-uploads").list(`professional_registration/${applicantLogin}`);
    for (const file of uploads ?? []) {
      await admin.storage.from("request-uploads").remove([`professional_registration/${applicantLogin}/${file.name}`]);
    }
    if (applicantLogin) await admin.auth.admin.deleteUser(applicantLogin);
  });

  test("an applicant's menu offers only Support and Log out, with their photo", async ({ page }) => {
    test.setTimeout(90_000);
    await loginDoctorUi(page, applicantEmail, PASSWORD);
    await page.goto("/agenda/status", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /under review/i })).toBeVisible({ timeout: 20_000 });

    // The badge is the uploaded photo (a short-lived link to the private upload), not initials.
    const badgePhoto = page.getByTestId("userbar-toggle").locator("img");
    await expect(badgePhoto).toBeVisible({ timeout: 30_000 });
    await expect(badgePhoto).toHaveAttribute("src", /request-uploads/);

    const menu = await openDesktopMenu(page);
    await expect(menu).toContainText(`Menu ${lastName}`);
    await expect(menu.getByTestId("userbar-action-support")).toBeVisible();
    await expect(menu.getByTestId("userbar-action-logout")).toBeVisible();
    await expect(menu.locator("[data-testid^='userbar-link-']")).toHaveCount(0);
  });

  test("on a phone, the applicant's tab bar offers only Support and Log out", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginDoctorUi(page, applicantEmail, PASSWORD);
    await page.goto("/agenda/status", { waitUntil: "domcontentloaded" });
    const tabs = page.getByTestId("userbar-mobile-tabs");
    await expect(tabs).toBeVisible({ timeout: 30_000 });
    await expect(tabs.getByTestId("userbar-tab-support")).toBeVisible();
    await expect(tabs.getByTestId("userbar-tab-logout")).toBeVisible();
    await expect(tabs.getByTestId("userbar-tab-agenda")).toHaveCount(0);
    await expect(tabs.getByTestId("userbar-tab-settings")).toHaveCount(0);
    await expect(tabs.getByTestId("userbar-tab-more")).toHaveCount(0);
  });

  test("an account with no profile and no application is not kept signed in", async ({ page }) => {
    test.setTimeout(90_000);
    const email = `menu-none-${Date.now()}@integration.test`;
    const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(`login: ${created.error?.message}`);
    try {
      await loginDoctorUi(page, email, PASSWORD);
      await page.goto("/agenda", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/agenda\/status$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: /No professional profile yet/i })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("link", { name: "Join as a professional" })).toHaveAttribute("href", "/register");
      await expect(page.getByRole("link", { name: /Back to the finder/i })).toBeVisible();

      // Signed out underneath the message: no menu, and the agenda asks for a sign-in again.
      await expect(page.getByTestId("status-signed-out")).toBeAttached({ timeout: 20_000 });
      await expect(page.getByTestId("userbar-toggle")).toHaveCount(0, { timeout: 20_000 });
      await page.goto("/agenda", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    } finally {
      await admin.auth.admin.deleteUser(created.data.user.id);
    }
  });

  test("a professional keeps the full menu", async ({ page }) => {
    test.setTimeout(120_000);
    const nonce = `menu${Date.now()}`.slice(-12);
    let fixture: TestDoctorFixture | null = null;
    try {
      fixture = await createTestDoctor({
        admin,
        nonce,
        name: `Menu Doctor ${nonce.slice(-4)}`,
        specialty: "Cardiology",
        is_specialty_approved: true,
      });
      await loginDoctorUi(page, fixture.email, fixture.password);
      await page.goto("/agenda", { waitUntil: "domcontentloaded" });
      const menu = await openDesktopMenu(page);
      await expect(menu.getByTestId("userbar-link-agenda")).toBeVisible();
      await expect(menu.getByTestId("userbar-link-settings")).toBeVisible();
      await expect(menu.getByTestId("userbar-action-support")).toBeVisible();
    } finally {
      if (fixture) await deleteTestDoctor(fixture);
    }
  });
});
