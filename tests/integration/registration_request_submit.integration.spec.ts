import { expect, test, type Page } from "@playwright/test";

import { buildAutomatedDoctorRegistrationTestEmail } from "@/lib/e2e-doctor-registration-test";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  answerRegisterAccountChoices,
  selectRegisterEnglishLanguage,
  uniqueRegisterTestMobile,
  uploadRegisterAvatar,
  waitForRegisterWizardReady,
} from "./helpers/goto-register-practice-step";
import { INTEGRATION_DOCTOR_PASSWORD } from "./helpers/test-doctor";
import { seedRegisterFixtures, type RegisterFixtures } from "./helpers/register-fixtures";

/**
 * Build PR 3 of the registration redesign: submitting /register no longer creates a
 * professional. It creates an unconfirmed login and a `request_drafts` row; confirming
 * the email moves the draft into `request_log` as a pending `professional_registration`
 * for the founders to review.
 *
 * Requests are permanent, so this spec's request stays in Testing's log (pending, its
 * login deleted). The login, draft and photo are removed.
 */

async function pickDocCyClinic(page: Page, query: string): Promise<void> {
  const input = page.getByTestId("register-clinic-search-0");
  await input.fill(query);
  const option = page.getByTestId("register-clinic-search-0-option").first();
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.click();
  await expect(page.locator("#register-form input[name='clinicId']")).not.toHaveValue("");
}

test.describe("Integration: registration request submit", { tag: "@pr-e2e" }, () => {
  // A DocCy clinic of its own to pick: CI's synthetic seed has none of Testing's.
  let fixtures: RegisterFixtures;
  test.beforeAll(async () => {
    fixtures = await seedRegisterFixtures(createIntegrationAdmin(requireSafeIntegration()));
  });
  test.afterAll(async () => {
    await fixtures?.remove();
  });
  const clinicQuery = () => `${fixtures.token} polykliniki`;

  test.describe.configure({ retries: 0 });

  test("submit stores a draft, and confirming the email makes it a pending request", async ({ page }) => {
    test.setTimeout(180_000);
    const env = requireSafeIntegration();
    const admin = createIntegrationAdmin(env);
    const email = buildAutomatedDoctorRegistrationTestEmail();
    const nonce = `${Date.now()}`.replace(/\d/g, (digit) => "abcdefghij"[Number(digit)]!);
    const lastName = `Etoe ${nonce}`;
    const mobile = uniqueRegisterTestMobile();
    let authUserId: string | null = null;
    let photoPath: string | null = null;

    try {
      await page.goto("/register", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("register-wizard-continue")).toBeVisible({ timeout: 20_000 });
      await waitForRegisterWizardReady(page);

      await page.locator("#register-form input[name='firstName']").fill("Register");
      await page.locator("#register-form input[name='lastName']").fill(lastName);
      await page.locator("#register-form input[name='email']").fill(email);
      await page.locator("#register-form input[name='password']").fill(INTEGRATION_DOCTOR_PASSWORD);
      await page.getByTestId("register-phone-input").fill(mobile);
      await answerRegisterAccountChoices(page, { gender: "Female", gesy: "No" });
      await page.getByTestId("register-wizard-continue").click();

      await expect(page.getByTestId("register-step-2")).toBeVisible({ timeout: 15_000 });
      await uploadRegisterAvatar(page);
      await selectRegisterEnglishLanguage(page);
      await page.getByTestId("register-wizard-continue").click();

      await expect(page.getByTestId("register-step-3")).toBeVisible();
      await page.getByTestId("register-specialty-trigger").click();
      await page.getByRole("button", { name: "Cardiology", exact: true }).click();
      await page.getByTestId("register-license-0").fill("REQ-LIC-123");
      await pickDocCyClinic(page, clinicQuery());
      const clinicId = await page.locator("#register-form input[name='clinicId']").inputValue();
      await page.locator("#register-form input[name='professionalDisclaimer']").check();

      await page.getByRole("button", { name: /Submit My Application/i }).click();
      await expect(page).toHaveURL(/\/register\?.*submitted=1/, { timeout: 90_000 });

      // A login exists, unconfirmed, and no professional was created.
      const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const logins: Array<{ id: string; email?: string; email_confirmed_at?: string }> = users?.users ?? [];
      const login = logins.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      expect(login?.id).toBeTruthy();
      authUserId = login!.id;
      expect(login!.email_confirmed_at ?? null).toBeNull();

      const { data: professionals } = await admin
        .from("professionals")
        .select("id")
        .eq("auth_user_id", authUserId);
      expect(professionals ?? []).toHaveLength(0);

      // The form waits in request_drafts.
      const { data: draft, error: draftError } = await admin
        .from("request_drafts")
        .select("request_type, details, details_version, requester_name, requester_email")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      expect(draftError).toBeNull();
      expect(draft?.request_type).toBe("professional_registration");
      expect(draft?.details_version).toBe(1);
      expect(draft?.requester_name).toBe(`Register ${lastName}`);
      expect(draft?.requester_email).toBe(email);
      const details = draft!.details as Record<string, unknown>;
      expect(details).toMatchObject({
        first_name: "Register",
        last_name: lastName,
        gender: "female",
        gesy: false,
        email,
        mobile,
        languages: ["English"],
        specialties: [{ name: "Cardiology", from_catalogue: true, license_number: "REQ-LIC-123" }],
        claimed_professional_id: null,
        disclaimer_accepted: true,
        // A test registration never takes a Founders' Club place.
        founders_club: false,
      });
      const clinics = details.clinics as Array<Record<string, unknown>>;
      expect(clinics).toHaveLength(1);
      expect(clinics[0]!.clinic_id).toBe(clinicId);

      // The photo waits in the private bucket, not in the public avatars bucket.
      const photo = details.photo as { bucket: string; path: string };
      expect(photo.bucket).toBe("request-uploads");
      photoPath = photo.path;
      expect(photoPath.startsWith(`professional_registration/${authUserId}/`)).toBe(true);
      const { data: photoFile, error: photoError } = await admin.storage
        .from("request-uploads")
        .download(photoPath);
      expect(photoError).toBeNull();
      expect((photoFile?.size ?? 0) > 0).toBe(true);

      // Confirming the email (the link in the "we received your application" email).
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      expect(linkError).toBeNull();
      const tokenHash = link!.properties!.hashed_token;
      await page.goto(`/auth/confirm-email?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`);
      await expect(page).toHaveURL(/email=confirmed/, { timeout: 30_000 });

      // The draft became a pending request linked to the login.
      const { data: requests, error: requestError } = await admin
        .from("request_log")
        .select("request_type, status, professional_id, applicant_auth_user_id, details, requester_email")
        .eq("applicant_auth_user_id", authUserId);
      expect(requestError).toBeNull();
      expect(requests ?? []).toHaveLength(1);
      expect(requests![0]).toMatchObject({
        request_type: "professional_registration",
        status: "pending",
        professional_id: null,
        requester_email: email,
      });
      expect(requests![0]!.details).toEqual(draft!.details);
      const { data: draftAfter } = await admin
        .from("request_drafts")
        .select("id")
        .eq("auth_user_id", authUserId);
      expect(draftAfter ?? []).toHaveLength(0);
    } finally {
      if (photoPath) {
        await admin.storage.from("request-uploads").remove([photoPath]);
      }
      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });
});
