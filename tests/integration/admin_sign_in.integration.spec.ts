import { expect, test, type Page } from "@playwright/test";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  adminCookieHeader,
  createServiceClient,
  createTestAdmin,
  createUserClient,
  deleteTestAdmin,
  sessionCookies,
  TEST_ADMIN_EMAIL_DOMAIN,
  totpCode,
  type TestAdmin,
} from "./helpers/test-admin";
import { createTestDoctor, deleteTestDoctor, type TestDoctorFixture } from "./helpers/test-doctor";

/**
 * The /internal admin sign-in (PR B): invite link → own password → authenticator
 * app → dashboard; returning admins; partners read-only; non-admin logins refused;
 * every internal API refuses requests without an admin session.
 */

const baseUrl = () => (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100").replace(/\/+$/, "");

async function addSessionCookies(page: Page, admin: TestAdmin) {
  const url = new URL(baseUrl());
  await page.context().addCookies(
    sessionCookies(admin.session!).map((c) => ({
      name: c.name,
      value: c.value,
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure: url.protocol === "https:",
      sameSite: "Lax" as const,
    })),
  );
}

async function enterCode(page: Page, secret: string) {
  await page.getByLabel("6-digit code").fill(totpCode(secret));
  await page.getByRole("button", { name: "Verify" }).click();
}

test.describe("Admin sign-in (/internal)", { tag: ["@pr-e2e"] }, () => {
  // First hits compile /internal pages on the dev server; the invite flow does several round trips.
  test.describe.configure({ timeout: 120_000 });

  test("signed out: dashboard redirects to sign-in and admin APIs refuse", async ({ page, request }) => {
    requireSafeIntegration();

    await page.goto("/internal/directory");
    await expect(page).toHaveURL(/\/internal\/sign-in\?next=%2Finternal%2Fdirectory/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible({ timeout: 20_000 });

    // /internal (old gate address, linked from emails) now leads to sign-in too.
    await page.goto("/internal");
    await expect(page).toHaveURL(/\/internal\/sign-in/, { timeout: 20_000 });

    const anyId = "00000000-0000-0000-0000-000000000000";
    const noSession = await request.post("/api/internal/doctors/verification", {
      data: { doctorId: anyId, action: "verify" },
    });
    expect(noSession.status()).toBe(401);

    // The retired shared-code cookie opens nothing, whatever its value.
    const oldCookie = await request.post("/api/internal/doctors/verification", {
      headers: { Cookie: `doccy-internal-directory=${process.env.INTERNAL_DIRECTORY_SECRET || "x"}` },
      data: { doctorId: anyId, action: "verify" },
    });
    expect(oldCookie.status()).toBe(401);

    const csv = await request.get("/api/internal/directory-clicks.csv");
    expect(csv.status()).toBe(401);
    const session = await request.get("/api/internal/session");
    expect(session.status()).toBe(401);
    expect((await session.json()).reason).toBe("signed_out");
  });

  test("invited founder sets a password, enrols an authenticator app and reaches the dashboard", async ({
    page,
  }) => {
    requireSafeIntegration();
    const service = createServiceClient();
    const tag = Math.random().toString(36).slice(2, 10);
    const email = `admin-invite-${tag}@${TEST_ADMIN_EMAIL_DOMAIN}`;
    const name = `Invited Founder ${tag}`;
    let authUserId: string | null = null;
    let adminId: string | null = null;

    try {
      // Same as scripts/invite-admin.mjs, but without sending the email.
      const link = await service.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo: `${baseUrl()}/internal/sign-in` },
      });
      expect(link.error).toBeNull();
      authUserId = link.data.user!.id;
      const row = await service
        .from("admin_users")
        .insert({ auth_user_id: authUserId, name, email, role: "founder" })
        .select("id")
        .single();
      expect(row.error).toBeNull();
      adminId = String(row.data!.id);

      // Follow the email link to GoTrue, then land on our page with its session hash
      // (independent of which redirect URLs the project allows).
      const verify = await fetch(link.data.properties.action_link, { redirect: "manual" });
      const location = verify.headers.get("location") ?? "";
      const hash = location.slice(location.indexOf("#"));
      expect(hash).toContain("access_token=");
      await page.goto(`/internal/sign-in${hash}`);

      await expect(page.getByRole("heading", { name: "Choose your password" })).toBeVisible({
        timeout: 20_000,
      });
      const password = `Adm1n-${tag}-Strong!`;
      await page.getByLabel("New password").fill(password);
      await page.getByLabel("Confirm password").fill(password);
      await page.getByRole("button", { name: "Save password" }).click();

      await expect(page.getByRole("heading", { name: "Set up your authenticator app" })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByAltText("Authenticator QR code")).toBeVisible();
      const secret = (await page.getByTestId("totp-secret").innerText()).replace(/\s+/g, "");
      expect(secret.length).toBeGreaterThanOrEqual(16);
      await enterCode(page, secret);

      await expect(page).toHaveURL(/\/internal\/directory/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(`Signed in: ${name}`)).toBeVisible();

      // The password they chose works: the login is theirs.
      const factors = await service.auth.admin.mfa.listFactors({ userId: authUserId });
      expect(factors.data?.factors.filter((f) => f.status === "verified")).toHaveLength(1);

      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/internal\/sign-in/, { timeout: 20_000 });
      await page.goto("/internal/directory");
      await expect(page).toHaveURL(/\/internal\/sign-in/, { timeout: 20_000 });
    } finally {
      if (adminId) await service.from("admin_users").delete().eq("id", adminId);
      if (authUserId) await service.auth.admin.deleteUser(authUserId);
    }
  });

  test("existing login made admin: reset link → new password → authenticator app → dashboard", async ({
    page,
  }) => {
    requireSafeIntegration();
    const service = createServiceClient();
    let admin: TestAdmin | null = null;
    try {
      // What `invite-admin.mjs --use-existing-login` leaves: an older login with an
      // admin row and no authenticator app, then a password-reset email.
      admin = await createTestAdmin({ role: "founder", withTotp: false });
      const link = await service.auth.admin.generateLink({
        type: "recovery",
        email: admin.email,
        options: { redirectTo: `${baseUrl()}/internal/sign-in` },
      });
      expect(link.error).toBeNull();
      const verify = await fetch(link.data.properties.action_link, { redirect: "manual" });
      const location = verify.headers.get("location") ?? "";
      const hash = location.slice(location.indexOf("#"));
      expect(hash).toContain("type=recovery");
      await page.goto(`/internal/sign-in${hash}`);

      await expect(page.getByRole("heading", { name: "Choose your password" })).toBeVisible({
        timeout: 20_000,
      });
      const password = `Reset-${Date.now()}-Strong!`;
      await page.getByLabel("New password").fill(password);
      await page.getByLabel("Confirm password").fill(password);
      await page.getByRole("button", { name: "Save password" }).click();

      await expect(page.getByRole("heading", { name: "Set up your authenticator app" })).toBeVisible({
        timeout: 20_000,
      });
      const secret = (await page.getByTestId("totp-secret").innerText()).replace(/\s+/g, "");
      await enterCode(page, secret);
      await expect(page).toHaveURL(/\/internal\/directory/, { timeout: 30_000 });
      await expect(page.getByText(`Signed in: ${admin.name}`)).toBeVisible({ timeout: 30_000 });

      // The new password is the one that works now.
      const check = await createUserClient().auth.signInWithPassword({ email: admin.email, password });
      expect(check.error).toBeNull();
    } finally {
      await deleteTestAdmin(admin);
    }
  });

  test("returning admin signs in with password and code", async ({ page }) => {
    requireSafeIntegration();
    let founder: TestAdmin | null = null;
    try {
      founder = await createTestAdmin({ role: "founder", withTotp: true });

      await page.goto("/internal/sign-in?next=%2Finternal%2Fdirectory");
      await page.getByLabel("Email").fill(founder.email);
      await page.getByLabel("Password", { exact: true }).fill(founder.password);
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page.getByRole("heading", { name: "Enter your authenticator code" })).toBeVisible({
        timeout: 20_000,
      });
      await enterCode(page, founder.totpSecret!);

      await expect(page).toHaveURL(/\/internal\/directory/, { timeout: 30_000 });
      await expect(page.getByText(`Signed in: ${founder.name}`)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Access: Read-only")).toHaveCount(0);
    } finally {
      await deleteTestAdmin(founder);
    }
  });

  test("partner can read but not change anything", async ({ page, request }) => {
    requireSafeIntegration();
    let partner: TestAdmin | null = null;
    try {
      partner = await createTestAdmin({ role: "partner", withTotp: true });
      const cookie = adminCookieHeader(partner);

      const session = await request.get("/api/internal/session", { headers: { Cookie: cookie } });
      expect(session.status()).toBe(200);
      expect(await session.json()).toMatchObject({ ok: true, role: "partner", canWrite: false });

      const csv = await request.get("/api/internal/directory-clicks.csv", { headers: { Cookie: cookie } });
      expect(csv.status()).toBe(200);

      const write = await request.post("/api/internal/doctors/verification", {
        headers: { Cookie: cookie },
        data: { doctorId: "00000000-0000-0000-0000-000000000000", action: "verify" },
      });
      expect(write.status()).toBe(403);
      expect((await write.json()).reason).toBe("read_only");

      await addSessionCookies(page, partner);
      await page.goto("/internal/directory");
      await expect(page.getByText("Access: Read-only")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(`Signed in: ${partner.name}`)).toBeVisible();
    } finally {
      await deleteTestAdmin(partner);
    }
  });

  test("a deactivated admin is refused at once", async ({ request }) => {
    requireSafeIntegration();
    const service = createServiceClient();
    let founder: TestAdmin | null = null;
    try {
      founder = await createTestAdmin({ role: "founder", withTotp: true });
      const cookie = adminCookieHeader(founder);
      expect((await request.get("/api/internal/session", { headers: { Cookie: cookie } })).status()).toBe(200);

      await service.from("admin_users").update({ is_active: false }).eq("id", founder.adminId);
      const after = await request.get("/api/internal/session", { headers: { Cookie: cookie } });
      expect(after.status()).toBe(403);
      expect((await after.json()).reason).toBe("inactive");
    } finally {
      await deleteTestAdmin(founder);
    }
  });

  test("non-admin logins are refused before any 2FA setup", async ({ page }) => {
    const env = requireSafeIntegration();
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let doctor: TestDoctorFixture | null = null;
    try {
      doctor = await createTestDoctor({
        admin: createIntegrationAdmin(env),
        nonce,
        name: `Admin Gate ${nonce}`,
        specialty: "Physiotherapist",
        is_specialty_approved: true,
        status: "verified",
      });

      await page.goto("/internal/sign-in");
      await page.getByLabel("Email").fill(doctor.email);
      await page.getByLabel("Password", { exact: true }).fill(doctor.password);
      await page.getByRole("button", { name: "Sign in" }).click();

      // (Next.js's route announcer is also role=alert, so match the message itself.)
      await expect(page.getByRole("alert").filter({ hasText: /professional account/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByRole("heading", { name: "Set up your authenticator app" })).toHaveCount(0);
      await page.goto("/internal/directory");
      await expect(page).toHaveURL(/\/internal\/sign-in/, { timeout: 20_000 });
    } finally {
      if (doctor) await deleteTestDoctor(doctor);
    }
  });
});
