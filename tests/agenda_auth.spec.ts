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
    await expect(
      page.getByRole("heading", { name: /Your agenda/i })
    ).not.toBeVisible();
  });

  test("unauthenticated user visiting /agenda/settings is redirected to /login", async ({
    page,
  }) => {
    await page.goto("/agenda/settings");

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: /Welcome back|Sign in/i })
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("heading", { name: /Working hours & availability/i })
    ).not.toBeVisible();
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
