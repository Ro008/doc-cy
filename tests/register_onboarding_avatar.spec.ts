import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import path from "node:path";

async function listAuthUsersByEmail(
  admin: SupabaseClient,
  email: string
) {
  const matches: { id: string; email: string }[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return matches;
    const users = data?.users ?? [];
    for (const u of users) {
      if ((u.email ?? "").toLowerCase() === email.toLowerCase()) {
        matches.push({ id: u.id, email: u.email ?? "" });
      }
    }
    if (users.length < 200) break;
    page += 1;
  }
  return matches;
}

async function cleanupAvatarFilesForAuthUser(admin: SupabaseClient, authUserId: string) {
  const prefix = `profiles/${authUserId}`;
  const { data: files } = await admin.storage.from("avatars").list(prefix, {
    limit: 100,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });
  const paths = (files ?? [])
    .filter((f) => f.name && !f.name.endsWith("/"))
    .map((f) => `${prefix}/${f.name}`);
  if (paths.length > 0) {
    await admin.storage.from("avatars").remove(paths);
  }
}

async function cleanupLicenseFilesForEmail(admin: SupabaseClient, email: string) {
  const emailPrefix = email
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .slice(0, 80);
  const folder = `licenses/${emailPrefix}`;
  const { data: files } = await admin.storage.from("doctor-verifications").list(folder, {
    limit: 100,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });
  const paths = (files ?? [])
    .filter((f) => f.name && !f.name.endsWith("/"))
    .map((f) => `${folder}/${f.name}`);
  if (paths.length > 0) {
    await admin.storage.from("doctor-verifications").remove(paths);
  }
}

test.describe("Doctor registration with mandatory avatar", () => {
  test("requires cropped avatar and cleans up created user", async ({ page }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
    const isLiveMode = process.env.PLAYWRIGHT_LIVE_REGISTRATION === "1";
    test.skip(
      !isLiveMode || /localhost|127\.0\.0\.1/i.test(baseUrl),
      "Live registration test is disabled. Set PLAYWRIGHT_LIVE_REGISTRATION=1 and PLAYWRIGHT_BASE_URL to a real environment."
    );

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    test.skip(!supabaseUrl || !serviceRole, "Missing Supabase env vars.");

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const email = `e2e-register-${nonce}@example.com`;
    const fullName = `E2E Register ${nonce}`;
    const imageFixture = path.resolve(
      process.cwd(),
      "tests",
      "fixtures",
      "e2e-person-avatar.jpg"
    );
    try {
      await page.goto("/register");

      await page.getByLabel("Full name").fill(fullName);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill("StrongPass123!");
      await page
        .getByLabel("WhatsApp Number (with country code, e.g., +357...)")
        .fill("+35799123456");

      // Specialty combobox -> pick first master option.
      await page.locator("#register-specialty-trigger").click();
      await page.locator("ul[role='listbox'] li button").first().click();

      // Languages multiselect -> pick first available language.
      await page.getByTestId("language-multiselect-trigger").click();
      await page
        .locator("#register-languages-listbox [role='option']")
        .first()
        .click();
      await page.keyboard.press("Escape");

      // Mandatory avatar flow: upload -> crop modal -> confirm crop.
      const avatarInput = page.locator("label:has-text('Upload photo') input[type='file']");
      await avatarInput.setInputFiles(imageFixture);
      await expect(page.getByText("Crop profile photo (1:1)")).toBeVisible();
      await page.getByRole("button", { name: /Confirm crop/i }).click();
      await expect(page.getByText("Crop confirmed.")).toBeVisible();

      // License number remains mandatory.
      await page
        .getByLabel(/Professional registration or certification number/i)
        .fill(`LIC-${nonce}`);

      await page.getByRole("checkbox", { name: /I confirm I am a licensed professional/i }).check();
      await page.getByRole("button", { name: /Submit application/i }).click();

      await expect(page).toHaveURL(/\/register\?submitted=1/, { timeout: 20000 });
      await expect(
        page.getByRole("heading", {
          name: /Thank you — your profile is under review/i,
        })
      ).toBeVisible({ timeout: 20000 });
    } finally {
      // Cleanup: remove doctor row + uploaded files + auth user so it never counts as a real signup.
      const { data: doctor } = await admin
        .from("doctors")
        .select("id,auth_user_id,license_file_url,avatar_url")
        .eq("email", email)
        .maybeSingle();

      const licensePath = doctor?.license_file_url
        ? String(doctor.license_file_url)
        : null;
      const avatarPath = doctor?.avatar_url ? String(doctor.avatar_url) : null;
      const authUsers = await listAuthUsersByEmail(admin, email);

      if (doctor?.id) {
        await admin.from("doctors").delete().eq("id", doctor.id);
      }

      if (licensePath) {
        await admin.storage.from("doctor-verifications").remove([licensePath]);
      }
      if (avatarPath) {
        await admin.storage.from("avatars").remove([avatarPath]);
      }

      if (doctor?.auth_user_id) {
        await admin.auth.admin.deleteUser(String(doctor.auth_user_id));
      }

      for (const u of authUsers) {
        await cleanupAvatarFilesForAuthUser(admin, u.id);
        await admin.auth.admin.deleteUser(u.id);
      }
      await cleanupLicenseFilesForEmail(admin, email);
    }
  });
});

