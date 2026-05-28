// tests/agenda_auth.spec.ts
// Critical: /agenda and /agenda/settings require authentication.
// Unauthenticated users must be redirected to /login and must not see agenda content.

import { test, expect } from "@playwright/test";

test.describe("Agenda route protection", () => {
  test("unauthenticated user visiting /agenda is redirected to /login", async ({
    page,
  }) => {
    await page.goto("/agenda");

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: /Welcome back|Sign in/i })
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Your Agenda · Today/i)).not.toBeVisible();
  });

  test("unauthenticated user visiting /agenda/settings is redirected to /login", async ({
    page,
  }) => {
    await page.goto("/agenda/settings");

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: /Welcome back|Sign in/i })
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/^Settings$/i)).not.toBeVisible();
  });

  test("unauthenticated user visiting /agenda/insights is redirected to login with next", async ({
    page,
  }) => {
    await page.goto("/agenda/insights");

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    const url = new URL(page.url());
    expect(url.searchParams.get("next")).toBe("/agenda/insights");
    await expect(
      page.getByRole("heading", { name: /Welcome back|Sign in/i })
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("heading", { name: "Practice insights" })).not.toBeVisible();
  });

  test("pending doctor visiting /agenda is redirected to account review", async ({
    page,
  }) => {
    const email = process.env.PLAYWRIGHT_PENDING_DOCTOR_EMAIL?.trim();
    const password = process.env.PLAYWRIGHT_PENDING_DOCTOR_PASSWORD?.trim();
    test.skip(!email || !password, "Set PLAYWRIGHT_PENDING_DOCTOR_EMAIL/PASSWORD");

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /Sign in/i }).click();

    await page.goto("/agenda");
    await expect(page).toHaveURL(/\/agenda\/account-review/, { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: /Account under review/i }),
    ).toBeVisible();
    await expect(page.getByText(/Your Agenda/i)).not.toBeVisible();
  });

  test("login page is functional after redirect (no broken redirect loop)", async ({
    page,
  }) => {
    await page.goto("/agenda");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Sign in/i })
    ).toBeVisible();
  });
});
