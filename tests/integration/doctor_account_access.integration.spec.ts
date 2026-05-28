import { expect, test } from "@playwright/test";
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

const PROTECTED_AGENDA_ROUTES = ["/agenda", "/agenda/settings", "/agenda/insights"] as const;

test.describe("Integration: doctor account access", () => {
  test("pending doctor is gated on all agenda routes", async ({ page }) => {
    const env = requireSafeIntegration();
    const admin = createIntegrationAdmin(env);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let fixture: TestDoctorFixture | null = null;

    try {
      fixture = await createTestDoctor({
        admin,
        nonce,
        name: `Pending ${nonce}`,
        specialty: "meditation",
        is_specialty_approved: false,
        status: "pending",
      });

      await loginDoctorUi(page, fixture.email, fixture.password);

      for (const route of PROTECTED_AGENDA_ROUTES) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/agenda\/account-review/, { timeout: 15000 });
      }
      await expect(
        page.getByRole("heading", { name: /Account under review/i }),
      ).toBeVisible();
      await expect(page.getByText(/Weekly calendar/i)).not.toBeVisible();
    } finally {
      if (fixture) await deleteTestDoctor(fixture);
    }
  });

  test("rejected specialty shows specialty-not-accepted copy", async ({ page }) => {
    const env = requireSafeIntegration({ needsInternalSecret: true });
    const admin = createIntegrationAdmin(env);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let fixture: TestDoctorFixture | null = null;

    try {
      fixture = await createTestDoctor({
        admin,
        nonce,
        name: `Spec Reject ${nonce}`,
        specialty: "meditation",
        is_specialty_approved: false,
        status: "pending",
      });

      const rejectRes = await postSpecialtyReview(page.request, env.internalSecret, {
        doctorId: fixture.doctorId,
        action: "reject_specialty",
      });
      expect(rejectRes.status()).toBe(200);

      await loginDoctorUi(page, fixture.email, fixture.password);
      await page.goto("/agenda");

      await expect(
        page.getByRole("heading", { name: /Specialty not accepted/i }),
      ).toBeVisible();
      await expect(page.getByText(/did not proceed with license verification/i)).toBeVisible();
    } finally {
      if (fixture) await deleteTestDoctor(fixture);
    }
  });

  test("rejected license shows license copy after specialty approved", async ({ page }) => {
    const env = requireSafeIntegration({ needsInternalSecret: true });
    const admin = createIntegrationAdmin(env);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let fixture: TestDoctorFixture | null = null;

    try {
      fixture = await createTestDoctor({
        admin,
        nonce,
        name: `Lic Reject ${nonce}`,
        specialty: "meditation",
        is_specialty_approved: false,
        status: "pending",
      });

      expect(
        (
          await postSpecialtyReview(page.request, env.internalSecret, {
            doctorId: fixture.doctorId,
            action: "approve_new",
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await postDoctorVerification(page.request, env.internalSecret, {
            doctorId: fixture.doctorId,
            action: "reject",
          })
        ).status(),
      ).toBe(200);

      await loginDoctorUi(page, fixture.email, fixture.password);
      await page.goto("/agenda");

      await expect(
        page.getByRole("heading", { name: /Application not approved/i }),
      ).toBeVisible();
      await expect(page.getByText(/could not verify your professional license/i)).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Specialty not accepted/i }),
      ).not.toBeVisible();
    } finally {
      if (fixture) await deleteTestDoctor(fixture);
    }
  });

  test("verified doctor opens agenda after specialty + license approval", async ({ page }) => {
    const env = requireSafeIntegration({ needsInternalSecret: true });
    const admin = createIntegrationAdmin(env);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let fixture: TestDoctorFixture | null = null;

    try {
      fixture = await createTestDoctor({
        admin,
        nonce,
        name: `Verified ${nonce}`,
        specialty: "meditation",
        is_specialty_approved: false,
        status: "pending",
      });

      expect(
        (
          await postSpecialtyReview(page.request, env.internalSecret, {
            doctorId: fixture.doctorId,
            action: "approve_new",
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await postDoctorVerification(page.request, env.internalSecret, {
            doctorId: fixture.doctorId,
            action: "verify",
          })
        ).status(),
      ).toBe(200);

      await loginDoctorUi(page, fixture.email, fixture.password);
      await page.waitForURL(
        (url) => new URL(url).pathname.replace(/\/$/, "") === "/agenda",
        { timeout: 20000 },
      );
      await expect(page.getByText(/Weekly calendar/i)).toBeVisible({ timeout: 15000 });
    } finally {
      if (fixture) await deleteTestDoctor(fixture);
    }
  });

  test("founder APIs: specialty before license; standard skips specialty queue", async ({
    request,
  }) => {
    const env = requireSafeIntegration({ needsInternalSecret: true });
    const admin = createIntegrationAdmin(env);
    const secret = env.internalSecret;
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let custom: TestDoctorFixture | null = null;
    let standard: TestDoctorFixture | null = null;

    try {
      custom = await createTestDoctor({
        admin,
        nonce: `c-${nonce}`,
        name: `Custom ${nonce}`,
        specialty: "meditation",
        is_specialty_approved: false,
        status: "pending",
      });

      expect(
        (await postDoctorVerification(request, secret, { doctorId: custom.doctorId, action: "verify" }))
          .status(),
      ).toBe(400);
      expect(
        (await postDoctorVerification(request, secret, { doctorId: custom.doctorId, action: "reject" }))
          .status(),
      ).toBe(400);

      expect(
        (
          await postSpecialtyReview(request, secret, {
            doctorId: custom.doctorId,
            action: "reject_specialty",
          })
        ).status(),
      ).toBe(200);
      expect(
        (await postDoctorVerification(request, secret, { doctorId: custom.doctorId, action: "verify" }))
          .status(),
      ).toBe(400);

      standard = await createTestDoctor({
        admin,
        nonce: `s-${nonce}`,
        name: `Standard ${nonce}`,
        specialty: "Pediatrics",
        is_specialty_approved: true,
        status: "pending",
      });
      expect(
        (
          await postDoctorVerification(request, secret, {
            doctorId: standard.doctorId,
            action: "verify",
          })
        ).status(),
      ).toBe(200);

      const row = await admin.from("doctors").select("status").eq("id", standard.doctorId).single();
      expect(row.data?.status).toBe("verified");
    } finally {
      if (custom) await deleteTestDoctor(custom);
      if (standard) await deleteTestDoctor(standard);
    }
  });

  test("specialty review API: merge, edit, reject, and validation", async ({ request }) => {
    const env = requireSafeIntegration({ needsInternalSecret: true });
    const admin = createIntegrationAdmin(env);
    const secret = env.internalSecret;
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let fixture: TestDoctorFixture | null = null;

    try {
      fixture = await createTestDoctor({
        admin,
        nonce,
        name: `Spec API ${nonce}`,
        specialty: "welness",
        is_specialty_approved: false,
        status: "pending",
      });
      const { doctorId } = fixture;

      expect(
        (await postSpecialtyReview(request, secret, { doctorId, action: "map", mapTo: "Wellness" }))
          .status(),
      ).toBe(200);
      let row = await admin
        .from("doctors")
        .select("specialty, is_specialty_approved, status")
        .eq("id", doctorId)
        .single();
      expect(row.data?.specialty).toBe("Wellness");
      expect(row.data?.is_specialty_approved).toBe(true);
      expect(row.data?.status).toBe("pending");

      await admin
        .from("doctors")
        .update({ specialty: "medittation", is_specialty_approved: false, status: "pending" })
        .eq("id", doctorId);

      expect(
        (
          await postSpecialtyReview(request, secret, {
            doctorId,
            action: "approve_edited",
            editedSpecialty: " Meditation ",
          })
        ).status(),
      ).toBe(200);
      row = await admin.from("doctors").select("specialty, is_specialty_approved").eq("id", doctorId).single();
      expect(row.data?.specialty).toBe("Meditation");
      expect(row.data?.is_specialty_approved).toBe(true);

      await admin
        .from("doctors")
        .update({ specialty: "oddity", is_specialty_approved: false, status: "pending" })
        .eq("id", doctorId);
      expect(
        (await postSpecialtyReview(request, secret, { doctorId, action: "reject_specialty" })).status(),
      ).toBe(200);
      row = await admin.from("doctors").select("status, is_specialty_approved").eq("id", doctorId).single();
      expect(row.data?.status).toBe("rejected");
      expect(row.data?.is_specialty_approved).toBe(false);

      await admin
        .from("doctors")
        .update({ specialty: "acupuncture", is_specialty_approved: false, status: "pending" })
        .eq("id", doctorId);
      expect(
        (
          await postSpecialtyReview(request, secret, {
            doctorId,
            action: "approve_edited",
            editedSpecialty: "Pediatrics",
          })
        ).status(),
      ).toBe(400);
    } finally {
      if (fixture) await deleteTestDoctor(fixture);
    }
  });
});
