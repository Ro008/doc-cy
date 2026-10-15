// Video 1: "Your DocCy dashboard in 20 seconds" (the doctor's /dashboard page).
// Recorded as the tutorial (16:9) and the reel (9:16). Accepting a request is undone first thing
// in every run, so the spec can be re-run against the same seeded stack.
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { signInDoctorAndSetCookies } from "../../tests/helpers/doctorAuth";
import { DEMO_REQUEST_EMAILS } from "./demo-data";
import { caption, glideClick, installOverlay, isReel, spotlight, startProgress } from "./helpers";

test("dashboard-tour", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const reel = isReel(testInfo);

  // Put the demo requests back to "waiting for your answer" (service role, local stack only).
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await admin.from("appointments").update({ status: "REQUESTED" }).in("patient_email", DEMO_REQUEST_EMAILS);

  const createdAt = Date.now();
  await signInDoctorAndSetCookies(page);
  await installOverlay(page, reel);
  await page.goto("/dashboard");
  const heading = page.getByRole("heading", { level: 1 }).first();
  await expect(heading).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("dashboard-pending-request").first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(600);

  // Everything before this moment is login plumbing; compose.mjs trims it using this offset.
  const startOffsetSec = (Date.now() - createdAt) / 1000;
  await startProgress(page, reel ? 17 : 19);

  await spotlight(page, heading.locator("xpath=.."), 14);
  await caption(page, reel ? "👋 Meet your\nDocCy dashboard" : "👋 Meet your DocCy dashboard", 2200, reel);

  const needsAnswer = page.locator('section[aria-labelledby="dashboard-pending-heading"]');
  await spotlight(page, needsAnswer, 8);
  await caption(page, reel ? "📥 New booking\nrequests land here" : "📥 New booking requests land here", 2500, reel);

  const firstRequest = page.getByTestId("dashboard-pending-request").first();
  const accept = firstRequest.getByRole("button", { name: "Accept" });
  await spotlight(page, firstRequest, 6);
  await caption(page, "✅ One tap to accept", 600, reel);
  await glideClick(page, accept, reel);
  await expect(firstRequest.getByText("Confirmed")).toBeVisible({ timeout: 10_000 });
  await spotlight(page, null);
  await caption(page, "🎉 Patient notified!", 1900, reel);

  const today = page.locator('section[aria-labelledby="dashboard-today-heading"]');
  await spotlight(page, today, 8);
  await caption(page, reel ? "📅 Your whole day\nat a glance" : "📅 Your whole day at a glance", 2600, reel);

  const manual = page.getByRole("button", { name: /manual booking/i }).first();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await page.waitForTimeout(500);
  await spotlight(page, manual, 10);
  await caption(page, reel ? "📞 Phone booking?\nAdd it in seconds" : "📞 Phone booking? Add it here", 2600, reel);

  await spotlight(page, null);
  await caption(page, "🩺 All in one place", 1800, reel);

  const outDir = process.env.TUTORIAL_VIDEOS_OUT ?? path.resolve("tutorial-videos-out");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `dashboard-tour.${testInfo.project.name}.json`), JSON.stringify({ startOffsetSec }));
});
