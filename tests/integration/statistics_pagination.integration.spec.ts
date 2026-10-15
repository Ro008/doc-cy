import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { adminCookieHeader, sharedTestFounder } from "./helpers/test-admin";

/**
 * The Statistics tab's tables show 10 rows at a time (user, 2026-10-15). Here, the finder's
 * "patients looking for unlisted professionals" table gets 12 requests, so it needs two pages.
 */
test.describe("Integration: statistics tables are paginated", { tag: "@pr-e2e" }, () => {
  let admin: SupabaseClient;
  const nonce = `pg${Date.now()}`.slice(-10);

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    const rows = Array.from({ length: 12 }, (_, i) => ({
      event_type: "missing_professional_report",
      actor_type: "visitor",
      visitor_key: `${nonce}-${i}`,
      source: "finder_empty_state",
      details: { requested_name: `Pager ${nonce} ${String(i).padStart(2, "0")}`, specialty: "Cardiology", district: null },
    }));
    const { error } = await admin.from("user_events").insert(rows);
    if (error) throw new Error(`seed: ${error.message}`);
  });

  test.afterAll(async () => {
    await admin.from("user_events").delete().like("visitor_key", `${nonce}-%`);
  });

  test("shows 10 rows, then the rest on the next page, and goes back", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    const founder = await sharedTestFounder();
    const host = new URL(baseURL!).hostname;
    await context.addCookies(
      adminCookieHeader(founder)
        .split("; ")
        .map((pair) => {
          const at = pair.indexOf("=");
          return { name: pair.slice(0, at), value: pair.slice(at + 1), domain: host, path: "/" };
        }),
    );
    await page.goto("/internal/directory?tab=statistics", { waitUntil: "domcontentloaded" });

    const section = page.getByTestId("finder-invitations");
    await expect(section).toBeVisible({ timeout: 60_000 });
    const pager = section.getByRole("navigation", { name: "Pages" });
    await expect(pager).toBeVisible();

    await expect(section.locator("tbody tr")).toHaveCount(10);
    await expect(pager).toContainText(/Showing 1–10 of \d+/);
    await expect(pager).toContainText(/Page 1 of \d+/);
    await expect(pager.getByRole("button", { name: "Previous" })).toBeDisabled();

    await pager.getByRole("button", { name: "Next" }).click();
    await expect(pager).toContainText(/Page 2 of \d+/);
    await expect(pager).toContainText(/Showing 11–/);
    await expect(pager.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(await section.locator("tbody tr").count()).toBeGreaterThanOrEqual(2);

    await pager.getByRole("button", { name: "Previous" }).click();
    await expect(pager).toContainText(/Page 1 of \d+/);
    await expect(section.locator("tbody tr")).toHaveCount(10);
  });
});
