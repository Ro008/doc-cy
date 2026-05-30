// Fast smoke: agenda routes require login (no Supabase test fixtures).
import { expect, test } from "@playwright/test";

const PROTECTED_ROUTES = [
  { path: "/agenda", forbidden: /Your Agenda/i },
  { path: "/agenda/settings", forbidden: /^Settings$/i },
  { path: "/agenda/insights", forbidden: /Practice insights/i, next: "/agenda/insights" },
] as const;

test.describe("Agenda route protection", { tag: "@pr-e2e" }, () => {
  test("guest is sent to login from protected agenda routes", async ({ page }) => {
    for (const route of PROTECTED_ROUTES) {
      await page.goto(route.path);
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
      if ("next" in route && route.next) {
        expect(new URL(page.url()).searchParams.get("next")).toBe(route.next);
      }
      await expect(
        page.getByRole("heading", { name: /Welcome back|Sign in/i }),
      ).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(route.forbidden)).not.toBeVisible();
    }
  });
});
