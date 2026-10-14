// Video 3: "Suggest other times", from the doctor's /dashboard, with the email her patient gets.
// The demo requests are put back to "waiting for your answer" first thing in every run, so the spec
// can be re-run on the same seeded stack.
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { signInDoctorAndSetCookies } from "../../tests/helpers/doctorAuth";
import { proposalEmail } from "./demo-emails";
import { DEMO_REQUEST_EMAILS } from "./demo-data";
import {
  caption,
  glideClick,
  hideEmail,
  installOverlay,
  isReel,
  scrollEmail,
  showEmail,
  spotlight,
  startProgress,
} from "./helpers";

const PATIENT = { name: "Pablo Ortega", email: "pablo.ortega@example.com" };

test("suggest-other-times", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const reel = isReel(testInfo);

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await admin
    .from("appointments")
    .update({ status: "REQUESTED", proposed_slots: null, proposal_expires_at: null })
    .in("patient_email", DEMO_REQUEST_EMAILS);

  const createdAt = Date.now();
  await signInDoctorAndSetCookies(page);
  await installOverlay(page, reel);
  await page.goto("/dashboard");
  const request = page.getByTestId("dashboard-pending-request").filter({ hasText: PATIENT.name });
  await expect(request).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(600);

  // Everything before this moment is login plumbing; compose.mjs trims it using this offset.
  const startOffsetSec = (Date.now() - createdAt) / 1000;
  await startProgress(page, 28);

  await spotlight(page, request, 6);
  await caption(page, "🔁 Can't make the time they asked for?", 2200, reel);
  await caption(page, "👉 Suggest other times", 700, reel);
  await glideClick(page, request.getByRole("link", { name: "Suggest other times" }), reel);
  // The page changes without a reload: clear the ring, or it stays hanging over the new page.
  await spotlight(page, null);
  await page.waitForURL(/\/dashboard\/appointments\//);

  const times = page.getByTestId("review-suggested-times");
  await expect(times.locator("li").first()).toBeVisible({ timeout: 20_000 });
  await spotlight(page, times, 12);
  await caption(page, "🗓️ Your next free times are already picked", 2800, reel);
  await spotlight(page, null);
  await caption(page, "📨 Send them to your patient", 700, reel);
  await glideClick(page, page.getByRole("button", { name: "Send proposal to patient" }), reel);
  await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 30_000 });
  await expect(page.getByText("You suggested other times", { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  await caption(page, "⏳ They have 24 hours to choose", 1700, reel);

  const { data: proposed } = await admin
    .from("appointments")
    .select("proposed_slots")
    .eq("patient_email", PATIENT.email)
    .single();
  await showEmail(page, proposalEmail(PATIENT, (proposed!.proposed_slots as string[]) ?? []));
  await caption(page, "📧 They pick one from this email", 2400, reel);
  await scrollEmail(page, 380, 1600);
  await hideEmail(page);

  await caption(page, "🩺 You do nothing else", 1700, reel);

  const outDir = process.env.TUTORIAL_VIDEOS_OUT ?? path.resolve("tutorial-videos-out");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `suggest-other-times.${testInfo.project.name}.json`), JSON.stringify({ startOffsetSec }));
});
