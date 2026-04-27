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
      if (em === email.toLowerCase()) matches.push({ id: u.id, email: em });
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
  if (paths.length > 0) await admin.storage.from("avatars").remove(paths);
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
  if (paths.length > 0) await admin.storage.from("doctor-verifications").remove(paths);
}

async function assertNoError(
  op: string,
  res: { error?: { message?: string | null } | null } | null | undefined
) {
  const message = res?.error?.message;
  if (message) {
    throw new Error(`[cleanup] ${op} failed: ${message}`);
  }
}

async function waitForDoctorByEmail(
  admin: SupabaseClient,
  email: string,
  timeoutMs = 20_000
): Promise<{ id: string; is_test_profile: boolean | null; name: string | null; phone: string | null; license_number: string | null } | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data, error } = await admin
      .from("doctors")
      .select("id,is_test_profile,name,phone,license_number")
      .eq("email", email)
      .maybeSingle();
    if (!error && data?.id) return data;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return null;
}

test.describe("Prod smoke: doctor registration", () => {
  test("completes registration and cleans up", async ({ page }) => {
    test.setTimeout(180_000);
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const isLiveMode = process.env.PLAYWRIGHT_LIVE_REGISTRATION === "1";
    test.skip(
      !isLiveMode || !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl),
      "Set PLAYWRIGHT_LIVE_REGISTRATION=1 and PLAYWRIGHT_BASE_URL to production."
    );

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    test.skip(!supabaseUrl || !serviceRole, "Missing Supabase credentials.");

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}`;
    const email = `test-registration-${nonce}${TEST_EMAIL_DOMAIN}`;
    const password = `Str0ngPass!${nonce.slice(-4)}`;
    const fullName = `Prod Smoke ${nonce}`;
    const uniquePhone = `+35799${String(Number(nonce) % 1_000_000).padStart(6, "0")}`;
    const licenseNumber = `LIC-${nonce}`;

    const imageFixture = path.resolve(process.cwd(), "tests", "assets", "dummy-doc.jpg");
    const licenseFixture = path.join(os.tmpdir(), `doccy-license-${nonce}.pdf`);
    await fs.writeFile(
      licenseFixture,
      "%PDF-1.1\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n",
      "utf8"
    );

    try {
      await page.goto("/register", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /Create|Register|profile/i })).toBeVisible({
        timeout: 20_000,
      });

      await page.getByLabel("Full name").fill(fullName);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByLabel("WhatsApp Number (with country code, e.g., +357...)").fill(uniquePhone);

      await page.locator("#register-specialty-trigger").click();
      await page.locator("ul[role='listbox'] li button").first().click();
      await page.getByTestId("language-multiselect-trigger").click();
      await page.locator("#register-languages-listbox [role='option']").first().click();
      await page.keyboard.press("Escape");
      await page.getByLabel("District").selectOption("Nicosia");

      const avatarInput = page.locator("label:has-text('Upload photo') input[type='file']");
      await avatarInput.setInputFiles(imageFixture);
      await expect(page.getByText("Crop profile photo (1:1)")).toBeVisible({ timeout: 10_000 });
      await page.getByRole("button", { name: /Confirm crop/i }).click();
      await expect(page.getByText("Crop confirmed.")).toBeVisible({ timeout: 10_000 });

      await page.getByLabel("Professional license number").fill(licenseNumber);
      await page.locator("input[name='licenseFile']").setInputFiles(licenseFixture);
      await page
        .getByRole("checkbox", { name: /I confirm I am a licensed professional/i })
        .check();

      await page.getByRole("button", { name: /Submit application/i }).click();

      const successHeading = page.getByRole("heading", {
        name: /Thank you|under review|Pending Evaluation/i,
      });
      try {
        await expect(successHeading).toBeVisible({ timeout: 45_000 });
      } catch {
        const visibleErrors = (
          await page
            .locator("[role='alert'], [data-testid*='error'], .text-red-500, .text-red-600")
            .allTextContents()
        )
          .map((t) => t.trim())
          .filter(Boolean)
          .join(" | ");
        throw new Error(
          `Registration UI did not reach success state. URL=${page.url()} Errors=${visibleErrors || "none"}`
        );
      }

      await expect(page).toHaveURL(/\/register(?:\?submitted=1)?(?:[&#].*)?$/, { timeout: 15_000 });

      const createdDoctor = await waitForDoctorByEmail(admin, email, 25_000);
      expect(
        createdDoctor?.id,
        `Doctor row not found in configured Supabase project for email ${email}. ` +
          `If running against production URL, ensure NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY point to the same production project.`
      ).toBeTruthy();
      expect(createdDoctor?.is_test_profile ?? null).toBe(false);
      expect(createdDoctor?.name ?? "").toBe(fullName);
      expect(createdDoctor?.phone ?? "").toContain("+357");
      expect(createdDoctor?.license_number ?? "").toBe(licenseNumber);
    } finally {
      const { data: doctor } = await admin
        .from("doctors")
        .select("id,auth_user_id,email,license_file_url")
        .eq("email", email)
        .maybeSingle();

      const authUsers = await listAuthUsersByEmail(admin, email);
      if (doctor?.id) {
        const delDoctorRes = await admin.from("doctors").delete().eq("id", doctor.id);
        await assertNoError(`delete doctor ${doctor.id}`, delDoctorRes);
      }
      if (doctor?.auth_user_id) {
        await cleanupAvatarFilesForAuthUser(admin, String(doctor.auth_user_id));
        const delAuthRes = await admin.auth.admin.deleteUser(String(doctor.auth_user_id));
        await assertNoError(
          `delete auth user ${String(doctor.auth_user_id)}`,
          { error: delAuthRes.error }
        );
      }
      for (const u of authUsers) {
        await cleanupAvatarFilesForAuthUser(admin, u.id);
        const delAuthRes = await admin.auth.admin.deleteUser(u.id);
        await assertNoError(`delete auth user ${u.id}`, { error: delAuthRes.error });
      }
      if (doctor?.license_file_url) {
        const rmLicenseRes = await admin.storage
          .from("doctor-verifications")
          .remove([String(doctor.license_file_url)]);
        await assertNoError(`remove explicit license path for ${email}`, rmLicenseRes);
      }
      await cleanupLicenseFilesForEmail(admin, email);
      await fs.unlink(licenseFixture).catch(() => {});
    }
  });
});

