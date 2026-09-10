import path from "node:path";
import { expect, test } from "@playwright/test";

import {
  E2E_REGISTER_CLINIC_EVENT,
  E2E_REGISTER_CLINIC_LOCATION,
} from "@/lib/e2e-doctor-registration-test";
import { waitForResendEmailWithSubject, fetchResendConfirmEmailUrl } from "../helpers/resend-sent-emails";
import { dismissCookieConsentIfPresent } from "../prod/helpers/dismissCookieConsent";
import { deleteRegistrationE2eDoctor } from "./helpers/delete-registration-e2e-doctor";
import {
  createIntegrationAdmin,
  requireSafeIntegration,
} from "./helpers/safe-integration";
import { selectRegisterEnglishLanguage } from "./helpers/goto-register-practice-step";
import { INTEGRATION_DOCTOR_PASSWORD } from "./helpers/test-doctor";

/**
 * Live `/register` UI against the testing database (not production).
 * Clinic confirmation uses the e2e hook (no Google Places) so CI stays stable.
 * Auth uses public `signUp` (gmail +alias), same path as a real professional.
 */
test.describe("Integration: doctor registration flow", { tag: "@local-register" }, () => {
  test.describe.configure({ retries: 0 });
  test("submits the register form, fires doctor confirm email first, then founder after confirm", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const env = requireSafeIntegration();
    const admin = createIntegrationAdmin(env);
    const nonce = `${Date.now()}`;
    const firstName = "Register";
    const lastName = `E2E ${nonce}`;
    const fullName = `${firstName} ${lastName}`;
    const email = `rociosirvent+rege2e${nonce}@gmail.com`;
    const resendKey = process.env.RESEND_API_KEY?.trim() ?? "";
    const founderNotify = process.env.FOUNDER_NOTIFY_EMAIL?.trim() ?? "";
    const canAssertResend = Boolean(resendKey && founderNotify);

    if (!canAssertResend && !process.env.CI) {
      throw new Error(
        "Set RESEND_API_KEY and FOUNDER_NOTIFY_EMAIL in .env.testing.local so this test can confirm the founder email.",
      );
    }

    try {
      await page.goto("/register", { waitUntil: "domcontentloaded" });
      await dismissCookieConsentIfPresent(page);
      await expect(
        page.getByRole("heading", { name: /List your practice on DocCy/i }),
      ).toBeVisible({ timeout: 20_000 });
      // Wait for the client form wrapper to hydrate before filling uncontrolled inputs.
      await expect(page.getByTestId("register-wizard-continue")).toBeVisible({ timeout: 20_000 });

      await page.locator("#register-form input[name='firstName']").fill(firstName);
      await page.locator("#register-form input[name='lastName']").fill(lastName);
      await page.locator("#register-form input[name='email']").fill(email);
      await page.locator("#register-form input[name='password']").fill(INTEGRATION_DOCTOR_PASSWORD);
      await page.locator("#register-form input[name='phone']").fill("+35799123456");
      await page.getByTestId("register-wizard-continue").click();

      await expect(page.getByTestId("register-step-2")).toBeVisible();
      const avatarPath = path.join(process.cwd(), "tests", "fixtures", "e2e-person-avatar.jpg");
      await page.getByTestId("register-avatar-file-input").setInputFiles(avatarPath);
      const confirmCrop = page.getByRole("button", { name: /Confirm crop/i });
      await expect(confirmCrop).toBeVisible({ timeout: 10_000 });
      await confirmCrop.click();
      await expect(page.getByText(/Ready for submission/i)).toBeVisible({ timeout: 15_000 });

      await selectRegisterEnglishLanguage(page);
      await page.getByTestId("register-wizard-continue").click();

      await expect(page.getByTestId("register-step-3")).toBeVisible();
      await expect(page.getByTestId("register-specialty-trigger")).toBeVisible();
      await page.getByTestId("register-specialty-trigger").click();
      await page.getByRole("button", { name: "Cardiology", exact: true }).click();
      await page.getByTestId("register-license-0").fill(`E2E-LIC-${nonce}`);

      const fillClinic = () =>
        page.evaluate(
          ({ eventName, location }) => {
            window.dispatchEvent(new CustomEvent(eventName, { detail: location }));
          },
          { eventName: E2E_REGISTER_CLINIC_EVENT, location: E2E_REGISTER_CLINIC_LOCATION },
        );
      await fillClinic();
      try {
        await expect(page.getByText(/District:\s*Nicosia/i)).toBeVisible({ timeout: 5_000 });
      } catch {
        await fillClinic();
        await expect(page.getByText(/District:\s*Nicosia/i)).toBeVisible({ timeout: 10_000 });
      }

      await page.locator("#register-form input[name='professionalDisclaimer']").check();

      await expect(page.locator("#register-form input[name='firstName']")).toHaveValue(firstName);
      await expect(page.locator("#register-form input[name='lastName']")).toHaveValue(lastName);
      await expect(page.locator("#register-form input[name='company']")).toHaveValue("");

      const overlay = page.getByTestId("register-submit-overlay");
      await expect(overlay).toBeHidden();
      await page.getByRole("button", { name: /Submit My Application/i }).click();
      await expect(overlay).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole("button", { name: /Submitting your application/i })).toBeVisible();

      await expect(page).toHaveURL(/\/register\?/, { timeout: 90_000 });
      if (!/submitted=1/.test(page.url())) {
        throw new Error(`Registration did not succeed. URL: ${page.url()}`);
      }
      await expect(
        page.getByRole("heading", { name: /confirm your email to continue/i }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(overlay).toBeHidden();

      const { data: byRegistration, error: regErr } = await admin
        .from("professionals")
        .select("id, email, registration_email, is_test_profile, status")
        .eq("registration_email", email)
        .maybeSingle();
      if (regErr) throw new Error(`Failed reading registered doctor: ${regErr.message}`);
      let doctor = byRegistration;
      if (!doctor?.id) {
        const { data: byEmail, error: emailErr } = await admin
          .from("professionals")
          .select("id, email, registration_email, is_test_profile, status")
          .eq("email", email)
          .maybeSingle();
        if (emailErr) throw new Error(`Failed reading registered doctor: ${emailErr.message}`);
        doctor = byEmail;
      }
      expect(doctor?.id).toBeTruthy();
      expect(doctor?.is_test_profile).toBe(true);

      if (canAssertResend) {
        const receivedMail = await waitForResendEmailWithSubject({
          apiKey: resendKey,
          subjectIncludes: "We received your application",
          toIncludes: email,
          timeoutMs: 30_000,
        });
        expect(receivedMail.subject).toMatch(/We received your application/i);

        const confirmUrl = await fetchResendConfirmEmailUrl({
          apiKey: resendKey,
          emailId: receivedMail.id,
        });
        expect(confirmUrl).toBeTruthy();
        await page.goto(confirmUrl!, { waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(/email=confirmed/, { timeout: 30_000 });

        const founderMail = await waitForResendEmailWithSubject({
          apiKey: resendKey,
          subjectIncludes: fullName,
          timeoutMs: 30_000,
        });
        expect(founderMail.subject).toMatch(/New registration/i);
      }
    } finally {
      await deleteRegistrationE2eDoctor(admin, email);
    }
  });
});
