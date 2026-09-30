import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { loginDoctorUi } from "./helpers/test-doctor";

/**
 * Request follow-up 1: an applicant withdraws their own pending registration from
 * the Status page, then sees "withdrawn" with "Apply again". The request stays in
 * Testing's permanent log as withdrawn; the login is removed.
 */

const baseUrl = () => (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100").replace(/\/+$/, "");
const PASSWORD = "StrongPass123!";

test.describe("Integration: applicant withdraws a pending registration", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial", retries: 0 });

  let admin: SupabaseClient;
  let email: string;
  let authUserId: string;
  let requestId: string;

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    email = `withdraw-${Date.now()}@integration.test`;
    const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(`login: ${created.error?.message}`);
    authUserId = created.data.user.id;
    const draft = await admin.rpc("request_draft_submit", {
      p_request_type: "professional_registration",
      p_auth_user_id: authUserId,
      p_details: { first_name: "Withdraw", last_name: "Applicant", email },
      p_details_version: 1,
      p_requester_name: "Withdraw Applicant",
      p_requester_email: email,
    });
    if (draft.error) throw new Error(`draft: ${draft.error.message}`);
    const confirmed = await admin.rpc("request_draft_confirm", { p_auth_user_id: authUserId });
    if (confirmed.error) throw new Error(`confirm: ${confirmed.error.message}`);
    requestId = String((confirmed.data as Array<{ request_id: string }>)[0]!.request_id);
  });

  test.afterAll(async () => {
    if (authUserId) await admin.auth.admin.deleteUser(authUserId);
  });

  test("withdrawing needs a signed-in applicant", async ({ request }) => {
    const res = await request.post(`${baseUrl()}/api/register/withdraw`);
    expect(res.status(), await res.text()).toBe(401);
    const { data } = await admin.from("request_log").select("status").eq("id", requestId).single();
    expect(data?.status).toBe("pending");
  });

  test("the applicant withdraws from the Status page and can apply again", async ({ page }) => {
    test.setTimeout(120_000);
    await loginDoctorUi(page, email, PASSWORD);
    await page.goto("/agenda/status", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /under review/i })).toBeVisible({ timeout: 20_000 });

    // Server-rendered: the click can land before hydration, so retry until the confirm step shows.
    await expect(async () => {
      await page.getByTestId("withdraw-application").click({ timeout: 2_000 });
      await expect(page.getByTestId("withdraw-application-confirm")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    // "Keep it" backs out without changing anything.
    await page.getByRole("button", { name: "Keep it" }).click();
    await expect(page.getByTestId("withdraw-application-confirm")).toHaveCount(0);

    await page.getByTestId("withdraw-application").click();
    await page.getByTestId("withdraw-application-yes").click();
    await expect(page.getByRole("heading", { name: /withdrawn/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: /Apply again/i })).toBeVisible();

    const { data } = await admin
      .from("request_log")
      .select("status, decided_at, decided_by")
      .eq("id", requestId)
      .single();
    expect(data?.status).toBe("withdrawn");
    expect(data?.decided_at).not.toBeNull();
    expect(data?.decided_by).toBeNull();
  });
});
