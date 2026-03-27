import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

const TEST_EMAIL_DOMAIN = "@test-doccy.com.cy";

async function listAuthUsersByEmail(
  admin: SupabaseClient,
  email: string
): Promise<{ id: string; email: string }[]> {
  const matches: { id: string; email: string }[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return matches;
    const users = data?.users ?? [];
    for (const u of users) {
      const em = (u.email ?? "").toLowerCase();
      if (em === email.toLowerCase()) {
        matches.push({ id: u.id, email: em });
      }
    }
    if (users.length < 200) break;
  }
  return matches;
}

async function cleanupAvatarFilesForAuthUser(admin: SupabaseClient, authUserId: string) {
  const prefix = `profiles/${authUserId}`;
  const { data: files } = await admin.storage.from("avatars").list(prefix, {
    limit: 200,
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
    limit: 200,
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

test.describe("Production smoke: doctor registration", () => {
  test("completes registration flow in production and always cleans up", async ({ page }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const isLiveMode = process.env.PLAYWRIGHT_LIVE_REGISTRATION === "1";
    test.skip(
      !isLiveMode || !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl),
      "Set PLAYWRIGHT_LIVE_REGISTRATION=1 and PLAYWRIGHT_BASE_URL to a real environment."
    );

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    test.skip(!supabaseUrl || !serviceRole, "Missing Supabase service credentials.");

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}`;
    const email = `test-registration-${nonce}${TEST_EMAIL_DOMAIN}`;
    const fullName = `Prod Smoke ${nonce}`;

    const imageFixture = path.resolve(process.cwd(), "tests", "assets", "dummy-doc.jpg");
    const licenseFixture = path.join(os.tmpdir(), `doccy-license-${nonce}.pdf`);
    await fs.writeFile(
      licenseFixture,
      "%PDF-1.1\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n",
      "utf8"
    );

    try {
      await page.goto("/register");

      await page.getByLabel("Full name").fill(fullName);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill("StrongPass123!");
      await page
        .getByLabel("WhatsApp Number (with country code, e.g., +357...)")
        .fill("+35799123456");

      await page.locator("#register-specialty-trigger").click();
      await page.locator("ul[role='listbox'] li button").first().click();

      await page.getByTestId("language-multiselect-trigger").click();
      await page.locator("#register-languages-listbox [role='option']").first().click();
      await page.keyboard.press("Escape");

      const avatarInput = page.locator("label:has-text('Upload photo') input[type='file']");
      await avatarInput.setInputFiles(imageFixture);
      await expect(page.getByText("Crop profile photo (1:1)")).toBeVisible();
      await page.getByRole("button", { name: /Confirm crop/i }).click();
      await expect(page.getByText("Crop confirmed.")).toBeVisible();

      await page.getByLabel("Professional license number").fill(`LIC-${nonce}`);
      await page.locator("input[name='licenseFile']").setInputFiles(licenseFixture);
      await page
        .getByRole("checkbox", {
          name: /I confirm I am a licensed professional/i,
        })
        .check();
      await page.getByRole("button", { name: /Submit application/i }).click();

      await expect(page).toHaveURL(/\/register\?submitted=1/, { timeout: 30000 });
      await expect(
        page.getByRole("heading", {
          name: /Thank you|Registration Successful|Pending Evaluation|under review/i,
        })
      ).toBeVisible({ timeout: 30000 });
    } finally {
      // Always cleanup records/files even if assertions fail.
      const { data: doctor } = await admin
        .from("doctors")
        .select("id,auth_user_id,email,license_file_url")
        .eq("email", email)
        .maybeSingle();

      const authUsers = await listAuthUsersByEmail(admin, email);

      if (doctor?.id) {
        await admin.from("doctors").delete().eq("id", doctor.id);
      }

      if (doctor?.auth_user_id) {
        await cleanupAvatarFilesForAuthUser(admin, String(doctor.auth_user_id));
        await admin.auth.admin.deleteUser(String(doctor.auth_user_id));
      }

      for (const u of authUsers) {
        await cleanupAvatarFilesForAuthUser(admin, u.id);
        await admin.auth.admin.deleteUser(u.id);
      }

      if (doctor?.license_file_url) {
        await admin.storage
          .from("doctor-verifications")
          .remove([String(doctor.license_file_url)]);
      }
      await cleanupLicenseFilesForEmail(admin, email);
      await fs.unlink(licenseFixture).catch(() => {});
    }
  });
});

