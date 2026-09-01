import { expect, test } from "@playwright/test";

import { buildFounderNewRegistrationNotifyContent } from "@/lib/notify-founder-new-registration";
import { buildDoctorAccountVerifiedEmailContent } from "@/lib/send-doctor-account-verified-email";
import { getPublicBookingBaseUrl } from "@/lib/site-url";
import { postDoctorVerification, postSpecialtyReview } from "./helpers/internal-api";
import {
  createIntegrationAdmin,
  requireSafeIntegration,
} from "./helpers/safe-integration";
import {
  createTestDoctor,
  deleteTestDoctor,
  loginDoctorUi,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

/**
 * Core business pipeline (PR-blocking):
 * registration outcome → founder alert payload → internal approval → doctor ready email copy → agenda access.
 *
 * Registration UI e2e was removed (chronic Places/cookie flakiness without signal).
 * Here we use createTestDoctor as post-registration DB state.
 * as the post-registration DB state equivalent (avoids Supabase Auth signUp rate limits on PR).
 */
test.describe("Integration: doctor onboarding pipeline", { tag: "@pr-e2e" }, () => {
  test("standard specialty: founder alert → verify license → doctor opens agenda", async ({
    page,
    request,
  }) => {
    const env = requireSafeIntegration({ needsInternalSecret: true });
    const admin = createIntegrationAdmin(env);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let fixture: TestDoctorFixture | null = null;

    try {
      fixture = await createTestDoctor({
        admin,
        nonce,
        name: `Onboard Std ${nonce}`,
        specialty: "Pediatrics",
        is_specialty_approved: true,
        status: "pending",
      });

      const founderContent = buildFounderNewRegistrationNotifyContent(
        {
          doctorId: fixture.doctorId,
          fullName: `Onboard Std ${nonce}`,
          email: fixture.email,
          phone: "+35799123456",
          specialty: "Pediatrics",
          needsSpecialtyReview: false,
        },
        getPublicBookingBaseUrl(),
      );
      expect(founderContent.subject).toContain("New registration");
      expect(founderContent.textBody).toContain(fixture.doctorId);
      expect(founderContent.textBody).toContain("/internal/directory");
      expect(founderContent.textBody).not.toContain("custom specialty pending");

      const verifyRes = await postDoctorVerification(request, env.internalSecret, {
        doctorId: fixture.doctorId,
        action: "verify",
      });
      expect(verifyRes.status()).toBe(200);
      expect(await verifyRes.json()).toMatchObject({ ok: true, status: "verified" });

      const row = await admin.from("professionals").select("status").eq("id", fixture.doctorId).single();
      expect(row.data?.status).toBe("verified");

      const doctorEmail = buildDoctorAccountVerifiedEmailContent({
        siteUrl: getPublicBookingBaseUrl(),
        doctorName: `Onboard Std ${nonce}`,
      });
      expect(doctorEmail.subject).toBe("[DocCy] Your account is ready");
      expect(doctorEmail.loginUrl).toContain("/login");

      await loginDoctorUi(page, fixture.email, fixture.password);
      await page.goto("/agenda");
      await expect(page).toHaveURL(
        (url) => new URL(url).pathname.replace(/\/$/, "") === "/agenda",
        { timeout: 20000 },
      );
      await expect(page.getByRole("button", { name: /^Today$/i })).toBeVisible({
        timeout: 15000,
      });
    } finally {
      if (fixture) await deleteTestDoctor(fixture);
    }
  });

  test("custom specialty: founder note → specialty approve → verify → doctor opens agenda", async ({
    page,
    request,
  }) => {
    const env = requireSafeIntegration({ needsInternalSecret: true });
    const admin = createIntegrationAdmin(env);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let fixture: TestDoctorFixture | null = null;

    try {
      fixture = await createTestDoctor({
        admin,
        nonce,
        name: `Onboard Custom ${nonce}`,
        specialty: "holistic coaching",
        is_specialty_approved: false,
        status: "pending",
      });

      const founderContent = buildFounderNewRegistrationNotifyContent(
        {
          doctorId: fixture.doctorId,
          fullName: `Onboard Custom ${nonce}`,
          email: fixture.email,
          phone: "+35799123456",
          specialty: "holistic coaching",
          needsSpecialtyReview: true,
        },
        getPublicBookingBaseUrl(),
      );
      expect(founderContent.textBody).toContain("custom specialty pending your approval");

      expect(
        (
          await postDoctorVerification(request, env.internalSecret, {
            doctorId: fixture.doctorId,
            action: "verify",
          })
        ).status(),
      ).toBe(400);

      expect(
        (
          await postSpecialtyReview(request, env.internalSecret, {
            doctorId: fixture.doctorId,
            action: "approve_new",
          })
        ).status(),
      ).toBe(200);

      expect(
        (
          await postDoctorVerification(request, env.internalSecret, {
            doctorId: fixture.doctorId,
            action: "verify",
          })
        ).status(),
      ).toBe(200);

      const row = await admin.from("professionals").select("status").eq("id", fixture.doctorId).single();
      expect(row.data?.status).toBe("verified");

      await loginDoctorUi(page, fixture.email, fixture.password);
      await page.goto("/agenda");
      await expect(page).toHaveURL(/\/agenda\/?$/, { timeout: 20000 });
      await expect(page.getByRole("button", { name: /^Today$/i })).toBeVisible({
        timeout: 15000,
      });
    } finally {
      if (fixture) await deleteTestDoctor(fixture);
    }
  });
});
