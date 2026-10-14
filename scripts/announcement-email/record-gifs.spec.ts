// The three animations of the "what's new" email: dashboard, agenda, settings. Each is recorded
// against the seeded demo doctor (scripts/tutorial-videos/seed-demo.mjs), a few seconds long and
// made to loop: the first frame already says what it is about (Outlook on a desktop shows only
// the first frame of a GIF). make-gifs.mjs turns the recordings into public/email/*.gif.
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { signInDoctorAndSetCookies } from "../../tests/helpers/doctorAuth";
import { DEMO_REQUEST_EMAILS } from "../tutorial-videos/demo-data";
import { caption, glideClick, installOverlay, spotlight } from "../tutorial-videos/helpers";

const outDir = process.env.ANNOUNCEMENT_OUT ?? path.resolve("announcement-out");

/** Login plumbing happens before this; make-gifs.mjs cuts the recording here. */
async function start(
  page: Page,
  name: string,
  startedAt: number,
  url: string,
  ready: () => Promise<void>,
  intro: () => Promise<void>,
) {
  await installOverlay(page, false);
  await page.goto(url);
  await ready();
  // The first frame is the one Outlook on a desktop shows: it already carries the caption.
  await intro();
  await page.waitForTimeout(650);
  const startOffsetSec = (Date.now() - startedAt) / 1000;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify({ startOffsetSec }));
}

test("dashboard", async ({ page }) => {
  test.setTimeout(120_000);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await admin
    .from("appointments")
    .update({ status: "REQUESTED", proposed_slots: null, proposal_expires_at: null })
    .in("patient_email", DEMO_REQUEST_EMAILS);

  const startedAt = Date.now();
  await signInDoctorAndSetCookies(page);
  const request = page.getByTestId("dashboard-pending-request").first();
  await start(page, "dashboard", startedAt, "/dashboard", async () => {
    await expect(request).toBeVisible({ timeout: 15_000 });
  }, async () => {
    await spotlight(page, page.locator('section[aria-labelledby="dashboard-pending-heading"]'), 8);
    await caption(page, "📥 Every request, one tap", 0);
  });

  await page.waitForTimeout(1300);
  await spotlight(page, request, 6);
  await glideClick(page, request.getByRole("button", { name: "Accept" }), false);
  await expect(request.getByText("Confirmed")).toBeVisible({ timeout: 10_000 });
  await spotlight(page, null);
  await caption(page, "🎉 Patient notified", 1300);
  const today = page.locator('section[aria-labelledby="dashboard-today-heading"]');
  await spotlight(page, today, 8);
  await caption(page, "📅 Your day at a glance", 2200);
  await spotlight(page, null);
  await caption(page, null, 300);
});

test("agenda", async ({ page }) => {
  test.setTimeout(120_000);
  const startedAt = Date.now();
  await signInDoctorAndSetCookies(page);
  await start(page, "agenda", startedAt, "/agenda", async () => {
    await expect(page.getByTestId("agenda-page")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Marco Bellini").first()).toBeVisible({ timeout: 20_000 });
  }, async () => {
    await caption(page, "🗓️ Your week at a glance", 0);
  });

  await page.waitForTimeout(1500);
  const month = page.locator("button:visible", { hasText: /^month$/i }).first();
  await glideClick(page, month, false);
  await expect(page.getByTestId("agenda-month-grid")).toBeVisible({ timeout: 10_000 });
  await caption(page, "📆 Or the whole month", 2200);
  const week = page.locator("button:visible", { hasText: /^week$/i }).first();
  await glideClick(page, week, false);
  await expect(page.getByText("Marco Bellini").first()).toBeVisible({ timeout: 10_000 });
  await caption(page, "👤 Open a visit for the details", 700);
  await glideClick(page, page.getByText("Marco Bellini").first(), false);
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  await caption(page, "✅ Everything about the patient", 2200);
  await caption(page, null, 300);
});

test("settings", async ({ page }) => {
  test.setTimeout(120_000);
  const startedAt = Date.now();
  await signInDoctorAndSetCookies(page);
  await start(page, "settings", startedAt, "/settings", async () => {
    await expect(page.getByRole("heading", { name: "Profile", level: 1 })).toBeVisible({ timeout: 20_000 });
  }, async () => {
    await spotlight(page, page.locator("aside, nav").getByText("Profile", { exact: true }).first().locator("xpath=ancestor::*[self::nav or self::aside][1]"), 8);
    await caption(page, "🧭 Everything in one place", 0);
  });

  const nav = (label: string) => page.locator("aside, nav").getByText(label, { exact: true }).first();
  await page.waitForTimeout(1100);
  await spotlight(page, null);
  await glideClick(page, nav("Clinics"), false);
  await caption(page, "⏰ Hours by the quarter hour", 1800);
  await glideClick(page, nav("Services & prices"), false);
  await caption(page, "💶 Prices you edit in place", 1800);
  await glideClick(page, nav("Promote"), false);
  await caption(page, "📣 Share your booking link", 1700);
  await caption(page, null, 300);
});
