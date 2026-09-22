import { expect, test } from "@playwright/test";
import {
  postDoctorVerification,
  postSpecialtyChangeReview,
  postSpecialtyReview,
} from "./helpers/internal-api";
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

test.describe("Integration: doctor account access", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ timeout: 120_000 });

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
      await expect(page.getByRole("button", { name: /^Today$/i })).not.toBeVisible();
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

      const row = await admin.from("professionals").select("status").eq("id", standard.doctorId).single();
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
    // Approving an edited label adds it to the catalogue, so make it unique per run
    // and delete it afterwards (a fixed label would already be in the catalogue on
    // the next run, and the route would then ask for a merge instead).
    const editedLabel = `Meditation ${nonce.replace(/\D/g, "").slice(-6)}`;

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

      // Each scenario queues a pending specialty the way /register and the
      // "Other" flow do: an unapproved professional_specialties row.
      const addPending = async (specialty: string) => {
        const res = await admin
          .from("professional_specialties")
          .insert({ professional_id: doctorId, specialty, license_number: `LIC-${nonce}`, is_approved: false })
          .select("id")
          .single();
        if (res.error) throw new Error(`pending specialty: ${res.error.message}`);
        return String(res.data.id);
      };
      // What the app derives from professional_specialties: approved labels
      // (alphabetical), the first one as `specialty`, and the pending flag.
      const readProfessional = async () => {
        const status = (
          await admin.from("professionals").select("status").eq("id", doctorId).single()
        ).data?.status;
        const rows =
          (
            await admin
              .from("professional_specialties")
              .select("is_approved, specialties(name)")
              .eq("professional_id", doctorId)
          ).data ?? [];
        const specialties = rows
          .filter((r) => r.is_approved)
          .map((r) => (r.specialties as { name?: string } | null)?.name ?? "")
          .sort((a, b) => a.localeCompare(b));
        return {
          status,
          specialty: specialties[0] ?? null,
          specialties,
          is_specialty_approved: rows.every((r) => r.is_approved),
        };
      };
      const specialtyLabels = async () =>
        (
          (
            await admin
              .from("professional_specialties")
              .select("specialty, is_approved")
              .eq("professional_id", doctorId)
          ).data ?? []
        ).map((r) => `${r.specialty}:${r.is_approved}`).sort();

      expect(
        (await postSpecialtyReview(request, secret, { doctorId, action: "map", mapTo: "Personal Doctor" }))
          .status(),
      ).toBe(200);
      let row = await readProfessional();
      expect(row?.specialty).toBe("Personal Doctor");
      expect(row?.is_specialty_approved).toBe(true);
      expect(row?.status).toBe("pending");

      // A second pending specialty, approved under an edited label.
      const meditationId = await addPending("medittation");
      expect((await readProfessional())?.is_specialty_approved).toBe(false);
      expect(
        (
          await postSpecialtyReview(request, secret, {
            doctorId,
            specialtyId: meditationId,
            action: "approve_edited",
            editedSpecialty: ` ${editedLabel} `,
          })
        ).status(),
      ).toBe(200);
      row = await readProfessional();
      expect(row?.specialties).toEqual([editedLabel, "Personal Doctor"]);
      expect(row?.is_specialty_approved).toBe(true);

      // Rejecting one of several specialties removes only that one.
      await addPending("oddity");
      expect(
        (await postSpecialtyReview(request, secret, { doctorId, action: "reject_specialty" })).status(),
      ).toBe(200);
      expect(await specialtyLabels()).toEqual([`${editedLabel}:true`, "Personal Doctor:true"]);
      row = await readProfessional();
      expect(row?.status).toBe("pending");
      expect(row?.is_specialty_approved).toBe(true);

      // Rejecting the only specialty closes the application.
      await admin.from("professional_specialties").delete().eq("professional_id", doctorId);
      await addPending("oddity");
      expect(
        (await postSpecialtyReview(request, secret, { doctorId, action: "reject_specialty" })).status(),
      ).toBe(200);
      row = await readProfessional();
      expect(row?.status).toBe("rejected");
      expect(row?.is_specialty_approved).toBe(false);

      // Nothing pending any more.
      await admin.from("professional_specialties").delete().eq("professional_id", doctorId);
      await admin.from("professionals").update({ status: "pending" }).eq("id", doctorId);
      await admin
        .from("professional_specialties")
        .insert({ professional_id: doctorId, specialty: "Personal Doctor", license_number: `LIC-${nonce}`, is_approved: true });
      expect(
        (await postSpecialtyReview(request, secret, { doctorId, action: "approve_new" })).status(),
      ).toBe(400);

      // Validation: "edit" must not be used for a standard specialty.
      await addPending("acupuncture");
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
      await admin.from("specialties").delete().eq("name", editedLabel);
    }
  });

  test("specialty change review API: add, replace and remove write professional_specialties", async ({
    request,
  }) => {
    const env = requireSafeIntegration({ needsInternalSecret: true });
    const admin = createIntegrationAdmin(env);
    const secret = env.internalSecret;
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let fixture: TestDoctorFixture | null = null;

    try {
      fixture = await createTestDoctor({
        admin,
        nonce,
        name: `Spec Change ${nonce}`,
        specialty: "Cardiology",
        is_specialty_approved: true,
        status: "verified",
      });
      const { doctorId } = fixture;

      const approve = async (request_kind: string, from: string | null, to: string | null) => {
        const inserted = await admin
          .from("professional_specialty_change_requests")
          .insert({
            professional_id: doctorId,
            request_kind,
            from_specialty: from,
            to_specialty: to,
            to_specialty_from_master: to !== null,
            license_number: to === null ? null : `LIC-CHG-${nonce}`,
            status: "pending",
          })
          .select("id")
          .single();
        if (inserted.error) throw new Error(`change request: ${inserted.error.message}`);
        const res = await postSpecialtyChangeReview(request, secret, {
          requestId: String(inserted.data.id),
          action: "approve",
        });
        expect(res.status(), await res.text()).toBe(200);
      };
      const state = async () => {
        const rows =
          (
            await admin
              .from("professional_specialties")
              .select("specialty, is_approved")
              .eq("professional_id", doctorId)
          ).data ?? [];
        return {
          rows: rows.map((r) => `${r.specialty}:${r.is_approved}`).sort(),
          specialties: rows
            .filter((r) => r.is_approved)
            .map((r) => r.specialty)
            .sort((a, b) => a.localeCompare(b)),
          approved: rows.every((r) => r.is_approved),
        };
      };

      // A catalogue name: legacy labels such as "Dermatology" are refused as picks.
      await approve("add", null, "Dermato-Venereology");
      expect(await state()).toEqual({
        rows: ["Cardiology:true", "Dermato-Venereology:true"],
        specialties: ["Cardiology", "Dermato-Venereology"],
        approved: true,
      });

      // "from" matches by slug, whatever its casing.
      await approve("replace", "cardiology", "Rheumatology");
      expect(await state()).toEqual({
        rows: ["Dermato-Venereology:true", "Rheumatology:true"],
        specialties: ["Dermato-Venereology", "Rheumatology"],
        approved: true,
      });

      await approve("remove", "Dermato-Venereology", null);
      expect(await state()).toEqual({
        rows: ["Rheumatology:true"],
        specialties: ["Rheumatology"],
        approved: true,
      });
    } finally {
      if (fixture) {
        await fixture.admin
          .from("professional_specialty_change_requests")
          .delete()
          .eq("professional_id", fixture.doctorId);
        await deleteTestDoctor(fixture);
      }
    }
  });
});
