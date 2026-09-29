import { expect, test } from "@playwright/test";

import { buildAutomatedDoctorRegistrationTestEmail } from "@/lib/e2e-doctor-registration-test";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  answerRegisterAccountChoices,
  selectRegisterEnglishLanguage,
  switchRegisterClinicToGoogle,
  uniqueRegisterTestMobile,
  uploadRegisterAvatar,
  waitForRegisterWizardReady,
} from "./helpers/goto-register-practice-step";
import { INTEGRATION_DOCTOR_PASSWORD } from "./helpers/test-doctor";

/**
 * A clinic that isn't in DocCy yet needs its phone: the public Call button shows the
 * clinic's number. Cyprus landlines and mobiles only, stored as 8 digits. A DocCy
 * clinic (picked, or the claimed listing's own) keeps its phone and asks for none.
 */

test.describe("Integration: registration clinic phone", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ retries: 0 });

  test("a new clinic can't be submitted without a valid Cyprus phone, and the draft keeps it", async ({ page }) => {
    test.setTimeout(180_000);
    const admin = createIntegrationAdmin(requireSafeIntegration());
    const email = buildAutomatedDoctorRegistrationTestEmail();
    let authUserId: string | null = null;
    let photoPath: string | null = null;

    try {
      await page.goto("/register", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("register-wizard-continue")).toBeVisible({ timeout: 20_000 });
      await waitForRegisterWizardReady(page);
      await page.locator("#register-form input[name='firstName']").fill("Clinic");
      await page.locator("#register-form input[name='lastName']").fill("Phone");
      await page.locator("#register-form input[name='email']").fill(email);
      await page.locator("#register-form input[name='password']").fill(INTEGRATION_DOCTOR_PASSWORD);
      await page.getByTestId("register-phone-input").fill(uniqueRegisterTestMobile());
      await answerRegisterAccountChoices(page);
      await page.getByTestId("register-wizard-continue").click();
      await expect(page.getByTestId("register-step-2")).toBeVisible({ timeout: 20_000 });
      await uploadRegisterAvatar(page);
      await selectRegisterEnglishLanguage(page);
      await page.getByTestId("register-wizard-continue").click();
      await expect(page.getByTestId("register-step-3")).toBeVisible();
      await page.getByTestId("register-specialty-trigger").click();
      await page.getByRole("button", { name: "Cardiology", exact: true }).click();
      await page.getByTestId("register-license-0").fill("PHONE-LIC-1");

      // A clinic not in DocCy: dropped pin, typed address and name.
      await switchRegisterClinicToGoogle(page, 0);
      const row = page.locator("[data-clinic-row='0']");
      await row.getByRole("button", { name: "Drop a pin instead" }).click();
      await row.getByLabel("District").selectOption("Paphos");
      await page.locator("#register-manual-street-0").fill("12 Apostolou Pavlou, Paphos");
      await page.locator("#register-clinic-name-0").fill("Phone Test Clinic");

      const clinicField = page.locator("[data-field-key='clinic']");
      const phone = page.getByTestId("register-clinic-phone-0");
      await expect(phone).toBeVisible();
      await expect(clinicField).toHaveAttribute("data-complete", "0");

      // Not a Cyprus landline or mobile.
      await phone.fill("12345678");
      await phone.blur();
      await expect(row.getByText(/valid Cyprus landline or mobile/i)).toBeVisible();
      await expect(clinicField).toHaveAttribute("data-complete", "0");

      // A landline is fine.
      await phone.fill("26 123456");
      await expect(row.getByText(/valid Cyprus landline or mobile/i)).toBeHidden();
      await row.getByRole("button", { name: "Save this location" }).click();
      await expect(clinicField).toHaveAttribute("data-complete", "1", { timeout: 10_000 });
      await expect(page.locator("#register-form input[name='clinicPhone']")).toHaveValue("26123456");

      await page.locator("#register-form input[name='professionalDisclaimer']").check();
      await page.getByRole("button", { name: /Submit My Application/i }).click();
      await expect(page).toHaveURL(/\/register\?.*submitted=1/, { timeout: 90_000 });

      const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const logins: Array<{ id: string; email?: string }> = users?.users ?? [];
      authUserId = logins.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
      expect(authUserId).toBeTruthy();
      const { data: draft } = await admin
        .from("request_drafts")
        .select("details")
        .eq("auth_user_id", authUserId!)
        .single();
      const details = draft!.details as {
        clinics: Array<{ clinic_id: string | null; name: string | null; phone: string | null }>;
        photo: { path: string };
      };
      photoPath = details.photo.path;
      expect(details.clinics).toHaveLength(1);
      expect(details.clinics[0]).toMatchObject({ clinic_id: null, name: "Phone Test Clinic", phone: "26123456" });
    } finally {
      if (photoPath) await admin.storage.from("request-uploads").remove([photoPath]);
      if (authUserId) await admin.auth.admin.deleteUser(authUserId);
    }
  });

  test("a claimed listing's clinics come in as DocCy clinics, with no phone to type", async ({ page }) => {
    test.setTimeout(120_000);
    const admin = createIntegrationAdmin(requireSafeIntegration());
    // An unregistered listing linked to an active clinic.
    const { data: links } = await admin
      .from("professional_clinics")
      .select("professional_id, clinic_id, clinics!inner(is_archived, address), professionals!inner(is_registered, is_archived)")
      .eq("clinics.is_archived", false)
      .not("clinics.address", "is", null)
      .eq("professionals.is_registered", false)
      .eq("professionals.is_archived", false)
      .eq("is_primary", true)
      .limit(1);
    const link = (links ?? [])[0] as { professional_id: string; clinic_id: string } | undefined;
    expect(link, "an unregistered listing with a clinic").toBeTruthy();

    await page.goto(`/register?claim=${link!.professional_id}`);
    await waitForRegisterWizardReady(page);
    await page.locator("#register-form input[name='email']").fill(buildAutomatedDoctorRegistrationTestEmail());
    await page.locator("#register-form input[name='password']").fill(INTEGRATION_DOCTOR_PASSWORD);
    await page.getByTestId("register-phone-input").fill(uniqueRegisterTestMobile());
    for (const group of ["Gender", /GeSY/] as const) {
      const radios = page.getByRole("radiogroup", { name: group });
      if ((await radios.locator("input:checked").count()) === 0) {
        await radios.getByText(group === "Gender" ? "Female" : "Yes", { exact: true }).click();
      }
    }
    await page.getByTestId("register-wizard-continue").click();
    await expect(page.getByTestId("register-step-2")).toBeVisible({ timeout: 20_000 });
    await uploadRegisterAvatar(page);
    await selectRegisterEnglishLanguage(page);
    await page.getByTestId("register-wizard-continue").click();
    await expect(page.getByTestId("register-step-3")).toBeVisible();

    // The primary clinic is the listing's own DocCy clinic, linked by id.
    await expect(page.locator("#register-form input[name='clinicId']")).toHaveValue(link!.clinic_id);
    await expect(page.getByTestId("register-clinic-phone-0")).toHaveCount(0);
    await expect(page.locator("[data-clinic-row='0'] [data-field-key='clinic'], [data-field-key='clinic']").first())
      .toHaveAttribute("data-complete", "1");
  });
});
