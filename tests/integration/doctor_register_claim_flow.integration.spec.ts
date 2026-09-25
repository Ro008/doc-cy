import path from "node:path";
import { expect, test } from "@playwright/test";

import {
  E2E_REGISTER_CLINIC_EVENT,
  E2E_REGISTER_CLINIC_LOCATION,
} from "@/lib/e2e-doctor-registration-test";
import { waitForResendEmailWithSubject, fetchResendConfirmEmailUrl } from "../helpers/resend-sent-emails";
import { dismissCookieConsentIfPresent } from "../prod/helpers/dismissCookieConsent";
import { deleteRegistrationE2eDoctor } from "./helpers/delete-registration-e2e-doctor";
import { createQaClaimDirectoryClone } from "./helpers/qa-claim-directory";
import {
  createIntegrationAdmin,
  requireSafeIntegration,
} from "./helpers/safe-integration";
import { founderCookie, postDoctorVerification } from "./helpers/internal-api";
import { selectRegisterEnglishLanguage } from "./helpers/goto-register-practice-step";
import { INTEGRATION_DOCTOR_PASSWORD } from "./helpers/test-doctor";

/**
 * Live finder-claim → `/register?claim=` against the testing database (not production).
 * Clicks "Claim this Profile" on the clone's public listing page.
 */
test.describe("Integration: directory claim registration flow", { tag: "@local-register" }, () => {
  test.describe.configure({ retries: 0 });
  test("absorbs a QA clone listing from its public profile CTA", async ({ page, request }) => {
    test.setTimeout(180_000);
    const env = requireSafeIntegration();
    const admin = createIntegrationAdmin(env);
    const nonce = `${Date.now()}`;
    const email = `rociosirvent+claime2e${nonce}@gmail.com`;
    const resendKey = process.env.RESEND_API_KEY?.trim() ?? "";
    const founderNotify = process.env.FOUNDER_NOTIFY_EMAIL?.trim() ?? "";
    const canAssertResend = Boolean(resendKey && founderNotify);
    const adminCookie = await founderCookie();
    let cloneId: string | null = null;

    if (!canAssertResend && !process.env.CI) {
      throw new Error(
        "Set RESEND_API_KEY and FOUNDER_NOTIFY_EMAIL in .env.testing.local so this test can confirm the founder email.",
      );
    }

    try {
      const clone = await createQaClaimDirectoryClone(admin, nonce);
      cloneId = clone.id;

      await page.goto(clone.profilePath, { waitUntil: "domcontentloaded" });
      await dismissCookieConsentIfPresent(page);
      const activate = page.getByRole("link", { name: /Claim this Profile/i });
      await expect(activate).toBeVisible({ timeout: 20_000 });
      await expect(activate).toHaveAttribute("href", `/register?claim=${clone.id}`);
      await activate.click();

      await expect(page).toHaveURL(new RegExp(`/register\\?claim=${clone.id}`), {
        timeout: 20_000,
      });
      await expect(page.getByText(/We were waiting for you/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("heading", { name: /Confirm your details to activate this listing/i })).toBeVisible();
      await expect(page.getByTestId("register-wizard-continue")).toBeVisible({ timeout: 20_000 });
      await expect(page.locator("#register-first-name")).toHaveValue("QA");
      await expect(page.locator("#register-last-name")).toHaveValue(
        new RegExp(`Claim Ioanna Severi ${nonce}`),
      );

      await page.locator("#register-form input[name='email']").fill(email);
      const passwordInput = page.locator("#register-form input[name='password']");
      await passwordInput.click();
      await passwordInput.fill(INTEGRATION_DOCTOR_PASSWORD);
      // Playwright fill can set the value without React's onChange; re-dispatch so UI state matches.
      await passwordInput.evaluate((el) => {
        const input = el as HTMLInputElement;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.locator("#register-form input[name='phone']").fill("+35799123456");
      for (const key of ["firstName", "lastName", "email", "password", "phone"]) {
        await expect(
          page.locator(`[data-register-step='1'] [data-field-key='${key}']`),
        ).toHaveAttribute("data-complete", "1", { timeout: 10_000 });
      }
      await page.getByTestId("register-wizard-continue").click();

      await expect(page.getByTestId("register-step-2")).toBeVisible({ timeout: 15_000 });
      const avatarPath = path.join(process.cwd(), "tests", "fixtures", "e2e-person-avatar.jpg");
      await page.getByTestId("register-avatar-file-input").setInputFiles(avatarPath);
      const confirmCrop = page.getByRole("button", { name: /Confirm crop/i });
      await expect(confirmCrop).toBeVisible({ timeout: 10_000 });
      await confirmCrop.click();
      await expect(page.getByText(/Ready for submission/i)).toBeVisible({ timeout: 15_000 });

      await selectRegisterEnglishLanguage(page);
      await page.getByTestId("register-wizard-continue").click();

      await expect(page.getByTestId("register-step-3")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("register-specialty-trigger")).toHaveText(
        /Obstetrics - Gynaecology/i,
        { timeout: 10_000 },
      );
      await page.getByTestId("register-license-0").fill(`E2E-CLAIM-${nonce}`);

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

      const overlay = page.getByTestId("register-submit-overlay");
      await expect(overlay).toBeHidden();
      await page.getByRole("button", { name: /Activate this listing/i }).click();
      await expect(overlay).toBeVisible({ timeout: 5_000 });

      // Claim URLs already include `?claim=…`, so wait for submitted (not merely `?`).
      await expect(page).toHaveURL(/[?&]submitted=1(?:&|$)/, { timeout: 90_000 });
      if (!/[?&]claimed=1(?:&|$)/.test(page.url())) {
        throw new Error(`Claim registration did not absorb the listing. URL: ${page.url()}`);
      }
      await expect(
        page.getByRole("heading", { name: /confirm your email to continue/i }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(overlay).toBeHidden();

      // The claimed clone must stay completely untouched while the
      // registration is pending — it's a fresh row that only remembers
      // claim_listing_id, never a conversion of the clone in place.
      const { data: untouchedClone, error: untouchedCloneErr } = await admin
        .from("professionals")
        .select("id, slug, is_registered, is_archived, directory_claim_source")
        .eq("id", clone.id)
        .maybeSingle();
      if (untouchedCloneErr) {
        throw new Error(`Failed reading claimed clone: ${untouchedCloneErr.message}`);
      }
      expect(untouchedClone?.id).toBe(clone.id);
      expect(untouchedClone?.slug).toBe(clone.slug);
      expect(untouchedClone?.is_registered).toBe(false);
      expect(untouchedClone?.is_archived).toBe(false);
      expect(untouchedClone?.directory_claim_source).toBeNull();

      const { data: pendingRow, error: pendingRowErr } = await admin
        .from("professionals")
        .select(
          "id, slug, is_registered, is_test_profile, status, registration_email, directory_claim_source, claim_listing_id",
        )
        .ilike("registration_email", email)
        .maybeSingle();
      if (pendingRowErr || !pendingRow?.id) {
        throw new Error(`Failed reading pending registration: ${pendingRowErr?.message}`);
      }
      const pendingDoctorId = String(pendingRow.id);
      expect(pendingDoctorId).not.toBe(clone.id);
      expect(pendingRow.slug).not.toBe(clone.slug);
      expect(pendingRow.is_registered).toBe(true);
      expect(pendingRow.is_test_profile).toBe(true);
      expect(pendingRow.status).toBe("pending");
      expect(pendingRow.directory_claim_source).toBe("card_link");
      expect(pendingRow.claim_listing_id).toBe(clone.id);

      const { count: twinCount, error: twinErr } = await admin
        .from("professionals")
        .select("id", { count: "exact", head: true })
        .eq("slug", clone.slug);
      if (twinErr) throw new Error(`Failed counting slug twins: ${twinErr.message}`);
      expect(twinCount).toBe(1);

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
        // Confirm links do not yet carry claimed=1; copy may say profile or listing.
        await expect(
          page.getByRole("heading", { name: /under review/i }),
        ).toBeVisible({ timeout: 15_000 });

        const founderMail = await waitForResendEmailWithSubject({
          apiKey: resendKey,
          subjectIncludes: `Finder listing claimed — ${clone.name}`,
          timeoutMs: 30_000,
        });
        expect(founderMail.subject).toMatch(/Finder listing claimed/i);
      }

      if (adminCookie) {
        const verify = await postDoctorVerification(request, adminCookie, {
          doctorId: pendingDoctorId,
          action: "verify",
        });
        expect(verify.ok()).toBeTruthy();
        const { data: verified } = await admin
          .from("professionals")
          .select("status")
          .eq("id", pendingDoctorId)
          .maybeSingle();
        expect(verified?.status).toBe("verified");

        // Verify absorbs the claimed clone (same mechanism as manual URL
        // absorb) — the clone is archived, not deleted.
        const { data: absorbedClone } = await admin
          .from("professionals")
          .select("is_archived")
          .eq("id", clone.id)
          .maybeSingle();
        expect(absorbedClone?.is_archived).toBe(true);
      }
    } finally {
      await deleteRegistrationE2eDoctor(admin, email);
      if (cloneId) {
        await admin.from("professional_specialties").delete().eq("professional_id", cloneId);
        await admin.from("doctor_locations").delete().eq("doctor_id", cloneId);
        await admin.from("doctor_services").delete().eq("doctor_id", cloneId);
        await admin.from("professional_settings").delete().eq("professional_id", cloneId);
        await admin.from("professionals").delete().eq("id", cloneId);
      }
    }
  });
});
