import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { seedRegisterFixtures, type RegisterFixtures } from "./helpers/register-fixtures";
import {
  createTestDoctor,
  deleteTestDoctor,
  loginDoctorUi,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

/**
 * A signed-in professional already has a profile (bug, 2026-09-29):
 * - listing cards don't offer her "Claim this Profile";
 * - /register (with or without ?claim=) shows "You already have a DocCy profile"
 *   instead of the form.
 * Signed-out visitors keep the claim prompt and the form.
 */
test.describe("Integration: a professional can't claim a listing", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial", retries: 0 });

  let admin: SupabaseClient;
  let fixtures: RegisterFixtures;
  let listingSlug: string;
  let professional: TestDoctorFixture | null = null;

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    fixtures = await seedRegisterFixtures(admin);
    const { data } = await admin
      .from("professionals")
      .select("slug")
      .eq("id", fixtures.listing.id)
      .single();
    listingSlug = String(data!.slug);
    const nonce = `claim${Date.now()}`.slice(-12);
    professional = await createTestDoctor({
      admin,
      nonce,
      name: `Claim Guard ${nonce.slice(-4)}`,
      specialty: "Cardiology",
    });
  });

  test.afterAll(async () => {
    if (professional) await deleteTestDoctor(professional);
    await fixtures?.remove();
  });

  test("a signed-out visitor sees Claim this Profile on the listing", async ({ page }) => {
    await page.goto(`/en/${listingSlug}`, { waitUntil: "domcontentloaded" });
    const claim = page.getByTestId("listing-claim-profile").getByRole("link");
    await expect(claim).toBeVisible({ timeout: 20_000 });
    await expect(claim).toHaveAttribute("href", `/register?claim=${fixtures.listing.id}`);
  });

  test("a signed-in professional doesn't see Claim this Profile", async ({ page }) => {
    test.setTimeout(90_000);
    await loginDoctorUi(page, professional!.email, professional!.password);
    await page.goto(`/en/${listingSlug}`, { waitUntil: "domcontentloaded" });
    // The session has loaded once her menu shows.
    await expect(page.getByTestId("userbar-toggle")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Report incorrect info/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("listing-claim-profile")).toBeHidden({ timeout: 20_000 });
  });

  test("/register tells a signed-in professional she already has a profile", async ({ page }) => {
    test.setTimeout(90_000);
    await loginDoctorUi(page, professional!.email, professional!.password);

    for (const path of [`/register?claim=${fixtures.listing.id}`, "/register"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { name: /You already have a DocCy profile/i }),
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.locator("#register-form")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Go to my agenda" })).toHaveAttribute(
        "href",
        "/agenda",
      );
      await expect(page.getByTestId("register-has-profile-contact")).toBeVisible();
    }
  });

  test("a signed-out visitor still gets the form", async ({ page }) => {
    await page.goto(`/register?claim=${fixtures.listing.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#register-form")).toBeAttached({ timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /You already have a DocCy profile/i }),
    ).toHaveCount(0);
  });
});
