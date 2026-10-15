// Video 2: "Accept or decline a booking request", from the doctor's /dashboard, with the email her
// patient gets after each answer. The demo requests are put back to "waiting for your answer" first
// thing in every run, so the spec can be re-run on the same seeded stack.
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { signInDoctorAndSetCookies } from "../../tests/helpers/doctorAuth";
import { confirmedEmail, declinedEmail } from "./demo-emails";
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

const ACCEPT = { name: "Irene Stavrou", email: "irene.stavrou@example.com" };
const DECLINE = { name: "Katrin Vogel", email: "katrin.vogel@example.com" };
const DECLINE_MESSAGE = "Sorry, I am away that day. Please book another time on my profile.";

test("accept-or-decline", async ({ page }, testInfo) => {
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
  const request = (name: string) => page.getByTestId("dashboard-pending-request").filter({ hasText: name });
  await expect(request(ACCEPT.name)).toBeVisible({ timeout: 15_000 });
  await expect(request(DECLINE.name)).toBeVisible();
  await page.waitForTimeout(600);

  // Everything before this moment is login plumbing; compose.mjs trims it using this offset.
  const startOffsetSec = (Date.now() - createdAt) / 1000;
  await startProgress(page, 34);

  // The list.
  const needsAnswer = page.locator('section[aria-labelledby="dashboard-pending-heading"]');
  await spotlight(page, needsAnswer, 8);
  await caption(page, "📥 Every request waits for your answer", 2400, reel);

  // Accept.
  await spotlight(page, request(ACCEPT.name), 6);
  await caption(page, "✅ Accept it: it goes to your agenda", 700, reel);
  await glideClick(page, request(ACCEPT.name).getByRole("button", { name: "Accept" }), reel);
  await expect(request(ACCEPT.name).getByText("Confirmed")).toBeVisible({ timeout: 10_000 });
  await spotlight(page, null);
  await caption(page, "🎉 Your patient is notified", 1500, reel);

  const { data: accepted } = await admin
    .from("appointments")
    .select("id, appointment_datetime, reason")
    .eq("patient_email", ACCEPT.email)
    .single();
  await showEmail(
    page,
    confirmedEmail(ACCEPT, { id: accepted!.id, startIso: accepted!.appointment_datetime, reason: accepted!.reason }),
  );
  await caption(page, "📧 This is the email they get", 2200, reel);
  await scrollEmail(page, 380, 1700);
  await hideEmail(page);

  // Decline.
  await expect(request(DECLINE.name)).toBeVisible({ timeout: 15_000 });
  await spotlight(page, request(DECLINE.name), 6);
  await caption(page, "🚫 Can't take it? Decline with a message", 1300, reel);
  await glideClick(page, request(DECLINE.name).getByRole("button", { name: "Decline" }), reel);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await spotlight(page, dialog, 6);
  await caption(page, "✍️ Say why in a few words", 400, reel);
  await dialog.getByRole("textbox").click();
  await page.keyboard.type(DECLINE_MESSAGE, { delay: 35 });
  await page.waitForTimeout(500);
  await glideClick(page, dialog.getByRole("button", { name: "Decline & notify" }), reel);
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await spotlight(page, null);
  await caption(page, "👍 They are told, politely", 1400, reel);

  await showEmail(page, declinedEmail(DECLINE, DECLINE_MESSAGE));
  await caption(page, "📧 They get your message and a link to book again", 2400, reel);
  await scrollEmail(page, 380, 1500);
  await hideEmail(page);

  await caption(page, "🩺 Every answer reaches your patient", 1800, reel);

  const outDir = process.env.TUTORIAL_VIDEOS_OUT ?? path.resolve("tutorial-videos-out");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `accept-or-decline.${testInfo.project.name}.json`), JSON.stringify({ startOffsetSec }));
});
