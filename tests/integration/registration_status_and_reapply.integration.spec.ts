import fs from "node:fs";
import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  REGISTER_AVATAR_FIXTURE,
  answerRegisterAccountChoices,
  selectRegisterEnglishLanguage,
  uploadRegisterAvatar,
  waitForRegisterWizardReady,
} from "./helpers/goto-register-practice-step";
import { adminCookieHeader, sharedTestFounder, type TestAdmin } from "./helpers/test-admin";
import { deleteTestClinics, loginDoctorUi } from "./helpers/test-doctor";

/**
 * Build PR 5 of the registration redesign: a signed-in applicant without a profile
 * sees only the Status page (pending, or denied with the reason); after a denial
 * they apply again with the same login (no new account, no password); once
 * approved they reach the agenda.
 *
 * Requests are permanent, so this spec's requests stay in Testing's log. The
 * professional, login, created clinics and photos are removed.
 */

const baseUrl = () => (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100").replace(/\/+$/, "");
const PASSWORD = "StrongPass123!";

test.describe("Integration: registration status and re-apply", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial", retries: 0 });

  let admin: SupabaseClient;
  let founder: TestAdmin;
  let email: string;
  let authUserId: string;
  let firstRequestId: string;
  const lastName = `Status ${Date.now().toString(36).replace(/\d/g, (d) => "abcdefghij"[Number(d)]!)}`;
  const photos: { bucket: string; path: string }[] = [];
  const clinics: string[] = [];
  let professionalId: string | null = null;

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    founder = await sharedTestFounder();

    // A confirmed applicant with a pending request (what build PR 3 produces).
    email = `status-${Date.now()}@integration.test`;
    const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(`login: ${created.error?.message}`);
    authUserId = created.data.user.id;
    const photoPath = `professional_registration/${authUserId}/photo-seed.jpg`;
    await admin.storage
      .from("request-uploads")
      .upload(photoPath, fs.readFileSync(REGISTER_AVATAR_FIXTURE), { contentType: "image/jpeg" });
    photos.push({ bucket: "request-uploads", path: photoPath });
    const { data: clinic } = await admin
      .from("clinics")
      .select("id, address, district")
      .eq("is_archived", false)
      .not("address", "is", null)
      .limit(1)
      .single();
    const draft = await admin.rpc("request_draft_submit", {
      p_request_type: "professional_registration",
      p_auth_user_id: authUserId,
      p_details: {
        first_name: "Review",
        last_name: lastName,
        gender: "female",
        gesy: true,
        email,
        mobile: "+35799123456",
        languages: ["English"],
        photo: { bucket: "request-uploads", path: photoPath },
        specialties: [{ name: "Cardiology", from_catalogue: true, license_number: "ST-1" }],
        clinics: [
          {
            clinic_id: clinic!.id,
            name: null,
            address: clinic!.address,
            district: clinic!.district,
            town: null,
            latitude: 35.1,
            longitude: 33.3,
            place_id: null,
          },
        ],
        claimed_professional_id: null,
        disclaimer_accepted: true,
      },
      p_details_version: 1,
      p_requester_name: `Review ${lastName}`,
      p_requester_email: email,
    });
    if (draft.error) throw new Error(`draft: ${draft.error.message}`);
    const confirmed = await admin.rpc("request_draft_confirm", { p_auth_user_id: authUserId });
    firstRequestId = String((confirmed.data as Array<{ request_id: string }>)[0]!.request_id);
  });

  test.afterAll(async () => {
    if (professionalId) await admin.from("professionals").delete().eq("id", professionalId);
    await deleteTestClinics(admin, clinics);
    const { data: uploads } = await admin.storage.from("request-uploads").list(`professional_registration/${authUserId}`);
    for (const file of uploads ?? []) photos.push({ bucket: "request-uploads", path: `professional_registration/${authUserId}/${file.name}` });
    for (const photo of photos) await admin.storage.from(photo.bucket).remove([photo.path]);
    if (authUserId) await admin.auth.admin.deleteUser(authUserId);
  });

  test("a pending applicant sees only the Status page", async ({ page }) => {
    test.setTimeout(90_000);
    await loginDoctorUi(page, email, PASSWORD);
    await page.goto("/agenda", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/agenda\/status$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /under review/i })).toBeVisible({ timeout: 20_000 });
    await page.goto("/agenda/settings", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/agenda\/status$/, { timeout: 30_000 });
  });

  test("after a denial the applicant sees the reason and applies again with the same login", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    const denied = await request.post(`${baseUrl()}/api/internal/requests/${firstRequestId}/deny`, {
      headers: { cookie: adminCookieHeader(founder) },
      data: { reason: "Licence number not found" },
    });
    expect(denied.status(), await denied.text()).toBe(200);

    await loginDoctorUi(page, email, PASSWORD);
    await page.goto("/agenda/status", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /not approved/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Licence number not found")).toBeVisible();
    await page.getByRole("link", { name: /Apply again/i }).click();

    await expect(page).toHaveURL(/\/register/, { timeout: 30_000 });
    await waitForRegisterWizardReady(page);
    // Signed in: the email is the login, and there is no password to create.
    await expect(page.locator("#register-form input[name='email']")).toHaveValue(email);
    await expect(page.locator("#register-form input[name='email']")).toHaveAttribute("readonly", "");
    await expect(page.locator("#register-form input[name='password']")).toHaveCount(0);

    await page.locator("#register-form input[name='firstName']").fill("Review");
    await page.locator("#register-form input[name='lastName']").fill(lastName);
    await page.getByTestId("register-phone-input").fill("+35799123456");
    await answerRegisterAccountChoices(page);
    await page.getByTestId("register-wizard-continue").click();
    await expect(page.getByTestId("register-step-2")).toBeVisible({ timeout: 15_000 });
    await uploadRegisterAvatar(page);
    await selectRegisterEnglishLanguage(page);
    await page.getByTestId("register-wizard-continue").click();
    await expect(page.getByTestId("register-step-3")).toBeVisible();
    await page.getByTestId("register-specialty-trigger").click();
    await page.getByRole("button", { name: "Cardiology", exact: true }).click();
    await page.getByTestId("register-license-0").fill("ST-2");
    await page.getByTestId("register-clinic-search-0").fill("lefkotheou");
    await page.getByTestId("register-clinic-search-0-option").first().click();
    await page.locator("#register-form input[name='professionalDisclaimer']").check();
    await page.getByRole("button", { name: /Submit My Application/i }).click();

    // Already confirmed: straight into the founders' queue, and back to the Status page.
    await expect(page).toHaveURL(/\/agenda\/status$/, { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: /under review/i })).toBeVisible({ timeout: 20_000 });

    const { data: requests } = await admin
      .from("request_log")
      .select("id, status")
      .eq("applicant_auth_user_id", authUserId)
      .order("created_at");
    expect(requests?.map((r) => r.status)).toEqual(["rejected", "pending"]);
    const { data: drafts } = await admin.from("request_drafts").select("id").eq("auth_user_id", authUserId);
    expect(drafts ?? []).toHaveLength(0);
  });

  test("once approved, the applicant reaches the agenda", async ({ page, request }) => {
    test.setTimeout(120_000);
    const { data: pending } = await admin
      .from("request_log")
      .select("id, details")
      .eq("applicant_auth_user_id", authUserId)
      .eq("status", "pending")
      .single();
    const approved = await request.post(`${baseUrl()}/api/internal/requests/${pending!.id}/approve`, {
      headers: { cookie: adminCookieHeader(founder) },
      data: { details: pending!.details },
    });
    expect(approved.status(), await approved.text()).toBe(200);
    professionalId = ((await approved.json()) as { professionalId: string }).professionalId;
    const { data: row } = await admin.from("request_log").select("outcome").eq("id", pending!.id).single();
    for (const clinic of ((row?.outcome as { clinics?: Array<{ clinic_id: string; created: boolean }> })?.clinics ??
      [])) {
      if (clinic.created) clinics.push(clinic.clinic_id);
    }
    const avatar = (row?.outcome as { avatar_path?: string | null })?.avatar_path;
    if (avatar) photos.push({ bucket: "avatars", path: avatar });
    await admin.from("professionals").update({ trial_notice_seen_at: new Date().toISOString() }).eq("id", professionalId);

    await loginDoctorUi(page, email, PASSWORD);
    await page.goto("/agenda/status", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/agenda$/, { timeout: 30_000 });
  });
});
