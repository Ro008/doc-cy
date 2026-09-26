import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { signInDoctorOrFail } from "../helpers/signInDoctorOrFail";

const DEFAULT_DURATION_MINUTES = 30;

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function overlapsUtc(startA: Date, durationA: number, startB: Date, durationB: number): boolean {
  const aStart = startA.getTime();
  const bStart = startB.getTime();
  return aStart < bStart + durationB * 60_000 && bStart < aStart + durationA * 60_000;
}

/** A free weekday slot a few days out, so Accept does not hit an overlap. */
function findFreeSlotIso(
  existing: Array<{ appointment_datetime: string; duration_minutes: number | null }>,
): string {
  const now = new Date();
  for (let dayOffset = 3; dayOffset <= 45; dayOffset += 1) {
    for (const hour of [9, 10, 11, 12, 14, 15, 16]) {
      const candidate = new Date(now);
      candidate.setUTCDate(now.getUTCDate() + dayOffset);
      candidate.setUTCHours(hour, 0, 0, 0);
      const weekday = candidate.getUTCDay();
      if (weekday === 0 || weekday === 6) continue;
      const clash = existing.some((row) =>
        overlapsUtc(
          candidate,
          DEFAULT_DURATION_MINUTES,
          new Date(row.appointment_datetime),
          row.duration_minutes && row.duration_minutes > 0 ? row.duration_minutes : DEFAULT_DURATION_MINUTES,
        ),
      );
      if (!clash) return candidate.toISOString();
    }
  }
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

/** Clicks before React hydrates are lost; the doctor chrome marks <html> once hydrated. */
async function waitForHydration(page: import("@playwright/test").Page) {
  await expect(page.locator("html")).toHaveAttribute("data-doccy-pro-chrome-hydrated", "1", {
    timeout: 20_000,
  });
}

/** Holds matching requests until release(), so the in-flight UI can be checked. */
async function holdRequests(page: import("@playwright/test").Page, pattern: string) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(pattern, async (route) => {
    await released;
    await route.continue();
  });
  return release;
}

async function expectRowBusy(card: import("@playwright/test").Locator) {
  await expect(card).toHaveAttribute("aria-busy", "true");
  await expect(card.getByRole("button", { name: /^Accept/ })).toBeDisabled();
  await expect(card.getByRole("button", { name: "Decline" })).toBeDisabled();
  await expect(card.getByRole("link", { name: /Suggest other times|Opening/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
}

type Setup = {
  admin: SupabaseClient;
  doctorEmail: string;
  doctorPassword: string;
  appointmentId: string;
  patientName: string;
};

async function createRequest(label: string): Promise<Setup> {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const doctorEmail = firstNonEmpty(process.env.TEST_DOCTOR_EMAIL, process.env.TEST_USER_EMAIL);
  const doctorPassword = firstNonEmpty(process.env.TEST_DOCTOR_PASSWORD, process.env.TEST_USER_PASSWORD);
  test.skip(
    !supabaseUrl || !serviceRoleKey || !doctorEmail || !doctorPassword,
    "Missing required integration env vars for dashboard actions.",
  );

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: doctor } = await admin
    .from("professionals")
    .select("id")
    .eq("email", doctorEmail)
    .maybeSingle();
  test.skip(!doctor?.id, `Test doctor not present in this dataset (${doctorEmail}).`);

  const { data: existing } = await admin
    .from("appointments")
    .select("appointment_datetime, duration_minutes")
    .eq("doctor_id", doctor!.id)
    .gte("appointment_datetime", new Date().toISOString());

  const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const patientName = `CI Dashboard ${label} ${nonce}`;
  const { data: inserted, error } = await admin
    .from("appointments")
    .insert({
      doctor_id: doctor!.id,
      patient_name: patientName,
      patient_email: `ci-dashboard-${nonce}@example.test`,
      patient_phone: "+35799123456",
      appointment_datetime: findFreeSlotIso(existing ?? []),
      duration_minutes: DEFAULT_DURATION_MINUTES,
      reason: "CI integration dashboard actions",
      status: "REQUESTED",
    })
    .select("id")
    .single();
  if (error || !inserted?.id) {
    throw new Error(`Could not create requested appointment: ${error?.message ?? "missing row"}`);
  }

  return { admin, doctorEmail, doctorPassword, appointmentId: String(inserted.id), patientName };
}

/** Turn a fresh request into "waiting for the patient" with three held times. */
async function makeProposal(setup: Setup): Promise<{ firstDay: string }> {
  const base = Date.now() + 5 * 24 * 60 * 60 * 1000;
  const slots = [0, 1, 2].map((i) => new Date(base + i * 60 * 60 * 1000));
  slots.forEach((d) => d.setUTCMinutes(0, 0, 0));
  await setup.admin
    .from("appointments")
    .update({
      status: "NEEDS_RESCHEDULE",
      proposed_slots: slots.map((d) => d.toISOString()),
      proposal_expires_at: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", setup.appointmentId);
  const firstDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Nicosia" }).format(slots[0]);
  return { firstDay };
}

test.describe("Integration: dashboard request actions", { tag: ["@pr-e2e", "@pr-e2e-booking"] }, () => {
  test("Accept confirms the request without leaving the dashboard", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await createRequest("Accept");
    try {
      await page.setViewportSize({ width: 1280, height: 900 });
      await signInDoctorOrFail(page, undefined, {
        email: setup.doctorEmail,
        password: setup.doctorPassword,
      });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await waitForHydration(page);

      const card = page.getByTestId("dashboard-pending-request").filter({ hasText: setup.patientName });
      await expect(card).toBeVisible({ timeout: 20_000 });
      await expect(card.getByRole("link", { name: "Suggest other times" })).toHaveAttribute(
        "href",
        `/dashboard/appointments/${setup.appointmentId}?intent=suggest&from=dashboard`,
      );

      const badge = page.getByTestId("pro-sticky-header").getByTestId("userbar-nav-dashboard-badge");
      const waitingBefore = await page.getByTestId("dashboard-pending-request").count();
      const label = (n: number) => (n <= 0 ? null : n > 9 ? "9+" : String(n));
      await expect(badge).toHaveText(label(waitingBefore)!, { timeout: 10_000 });

      const releaseConfirm = await holdRequests(page, "**/api/appointments/*/confirm");
      await card.getByRole("button", { name: "Accept" }).click();
      await expectRowBusy(card);
      await expect(card.getByRole("button", { name: "Accepting…" })).toBeVisible();
      releaseConfirm();

      await expect(card).toHaveCount(0, { timeout: 20_000 });
      await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);
      const after = label(waitingBefore - 1);
      if (after) await expect(badge).toHaveText(after, { timeout: 10_000 });
      else await expect(badge).toHaveCount(0);

      await expect
        .poll(async () => {
          const { data } = await setup.admin
            .from("appointments")
            .select("status")
            .eq("id", setup.appointmentId)
            .maybeSingle();
          return String(data?.status ?? "").toUpperCase();
        }, { timeout: 15_000 })
        .toBe("CONFIRMED");
    } finally {
      await setup.admin.from("appointments").delete().eq("id", setup.appointmentId);
    }
  });

  test("Decline asks for a reason and removes the request", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await createRequest("Decline");
    try {
      await page.setViewportSize({ width: 1280, height: 900 });
      await signInDoctorOrFail(page, undefined, {
        email: setup.doctorEmail,
        password: setup.doctorPassword,
      });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await waitForHydration(page);

      const card = page.getByTestId("dashboard-pending-request").filter({ hasText: setup.patientName });
      await expect(card).toBeVisible({ timeout: 20_000 });
      await card.getByRole("button", { name: "Decline" }).click();

      const dialog = page.getByRole("dialog", { name: /Decline this request/i });
      await expect(dialog).toBeVisible();
      const submit = dialog.getByRole("button", { name: "Decline & notify" });
      await expect(submit).toBeDisabled();

      await dialog.getByLabel(/Reason for the patient/i).fill("I am away that day, sorry.");
      await expect(submit).toBeEnabled();

      const releaseReject = await holdRequests(page, "**/api/appointments/*/reject");
      await submit.click();
      await expect(dialog.getByRole("button", { name: "Declining…" })).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "Go back" })).toBeDisabled();
      await expect(dialog.getByLabel(/Reason for the patient/i)).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      releaseReject();

      await expect(dialog).toBeHidden({ timeout: 15_000 });
      await expect(card).toHaveCount(0, { timeout: 20_000 });

      await expect
        .poll(async () => {
          const { data } = await setup.admin
            .from("appointments")
            .select("id")
            .eq("id", setup.appointmentId)
            .maybeSingle();
          return data?.id ?? null;
        }, { timeout: 15_000 })
        .toBeNull();
    } finally {
      await setup.admin.from("appointments").delete().eq("id", setup.appointmentId);
    }
  });

  test("Suggest other times opens the review page with three times ready to send", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await createRequest("Suggest");
    try {
      await page.setViewportSize({ width: 1280, height: 900 });
      await signInDoctorOrFail(page, undefined, {
        email: setup.doctorEmail,
        password: setup.doctorPassword,
      });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await waitForHydration(page);

      const card = page.getByTestId("dashboard-pending-request").filter({ hasText: setup.patientName });
      await expect(card).toBeVisible({ timeout: 20_000 });

      const releaseNavigation = await holdRequests(page, `**/dashboard/appointments/${setup.appointmentId}**`);
      await card.getByRole("link", { name: "Suggest other times" }).click();
      await expectRowBusy(card);
      await expect(card.getByRole("link", { name: "Opening…" })).toBeVisible();
      releaseNavigation();

      await expect(page).toHaveURL(new RegExp(`/dashboard/appointments/${setup.appointmentId}`), {
        timeout: 20_000,
      });
      // No overlap here: suggesting other times must still be possible.
      await expect(page.getByTestId("review-suggested-times").locator("li")).toHaveCount(3, {
        timeout: 20_000,
      });
      await expect(page.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/dashboard");
      // Suggest mode: the page is about sending new times, not confirming this one.
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Suggest other times to");
      await expect(page.getByRole("button", { name: /^Confirm / })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Keep the original time instead" })).toBeVisible();
      // Say where the times come from and that they are held.
      await expect(page.getByText(/DocCy checked your working hours and appointments/)).toBeVisible();
      await expect(page.getByText(/We'll hold these times for/)).toBeVisible();

      await page.getByRole("button", { name: "Send proposal to patient" }).click();
      await expect(page).toHaveURL(/\/dashboard(?:[?#]|$)/, { timeout: 20_000 });
      await expect
        .poll(async () => {
          const { data } = await setup.admin
            .from("appointments")
            .select("status")
            .eq("id", setup.appointmentId)
            .maybeSingle();
          return String(data?.status ?? "").toUpperCase();
        }, { timeout: 15_000 })
        .toBe("NEEDS_RESCHEDULE");
    } finally {
      await setup.admin.from("appointments").delete().eq("id", setup.appointmentId);
    }
  });

  test("Review page states the request, confirms with the time and can decline", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await createRequest("Review");
    try {
      await page.setViewportSize({ width: 1280, height: 900 });
      await signInDoctorOrFail(page, undefined, {
        email: setup.doctorEmail,
        password: setup.doctorPassword,
      });
      await page.goto(`/dashboard/appointments/${setup.appointmentId}`, { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { level: 1 })).toContainText(`${setup.patientName} wants`, {
        timeout: 20_000,
      });
      await expect(page.getByRole("button", { name: /^Confirm .+\d{2}:\d{2}–\d{2}:\d{2}$/ })).toBeVisible();
      await expect(page.getByText(/will get an email confirmation/)).toBeVisible();
      await expect(page.getByTestId("review-day-timeline")).toContainText("This request");
      await expect(page.getByRole("link", { name: "Back to agenda" })).toHaveAttribute("href", "/agenda");

      // This page has no doctor chrome to signal hydration; retry until the dialog opens.
      const dialog = page.getByRole("dialog", { name: /Decline this request/i });
      await expect(async () => {
        await page.getByRole("button", { name: "Decline" }).click();
        await expect(dialog).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await dialog.getByLabel(/Reason for the patient/i).fill("I am away that day, sorry.");
      await dialog.getByRole("button", { name: "Decline & notify" }).click();

      await expect(page).toHaveURL(/\/agenda(?:[?#]|$)/, { timeout: 20_000 });
      await expect
        .poll(async () => {
          const { data } = await setup.admin
            .from("appointments")
            .select("id")
            .eq("id", setup.appointmentId)
            .maybeSingle();
          return data?.id ?? null;
        }, { timeout: 15_000 })
        .toBeNull();
    } finally {
      await setup.admin.from("appointments").delete().eq("id", setup.appointmentId);
    }
  });

  test("Clicking a visit in Today opens the agenda with that visit highlighted", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await createRequest("Highlight");
    // Make it a confirmed visit today (Cyprus), inside the agenda grid (08:00–20:00).
    const todayCy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Nicosia" }).format(new Date());
    const minute = String(Math.floor(Math.random() * 50)).padStart(2, "0");
    const startIso = new Date(`${todayCy}T19:${minute}:00+03:00`).toISOString();
    await setup.admin
      .from("appointments")
      .update({ status: "CONFIRMED", appointment_datetime: startIso, duration_minutes: 15 })
      .eq("id", setup.appointmentId);
    try {
      // Phone size: the agenda shows single days there, so this works on weekends too
      // (the desktop week view only has Monday–Friday).
      await page.setViewportSize({ width: 390, height: 844 });
      await signInDoctorOrFail(page, undefined, {
        email: setup.doctorEmail,
        password: setup.doctorPassword,
      });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await waitForHydration(page);

      await page
        .getByTestId("dashboard-today-schedule")
        .getByRole("link", { name: new RegExp(`Appointment ${setup.patientName}`) })
        .click();
      await expect(page).toHaveURL(new RegExp(`/agenda\\?date=${todayCy}&highlight=${setup.appointmentId}`), {
        timeout: 20_000,
      });

      const chip = page.locator(`[data-appointment-id="${setup.appointmentId}"]`).filter({ visible: true });
      await expect(chip).toHaveAttribute("data-highlighted", "true", { timeout: 15_000 });
      await expect(chip).toBeInViewport();
      await expect(chip).toHaveAttribute("data-highlighted", "false", { timeout: 8_000 });
    } finally {
      await setup.admin.from("appointments").delete().eq("id", setup.appointmentId);
    }
  });

  test("View expands a waiting request in place with the held times", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await createRequest("Waiting");
    const { firstDay } = await makeProposal(setup);
    try {
      await page.setViewportSize({ width: 1280, height: 900 });
      await signInDoctorOrFail(page, undefined, {
        email: setup.doctorEmail,
        password: setup.doctorPassword,
      });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await waitForHydration(page);

      const row = page.getByTestId("dashboard-awaiting-patient").filter({ hasText: setup.patientName });
      await expect(row).toBeVisible({ timeout: 20_000 });
      const toggle = row.getByRole("button", { name: "View" });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await toggle.click();

      await expect(row.getByRole("button", { name: "Hide" })).toHaveAttribute("aria-expanded", "true");
      await expect(row.getByTestId("dashboard-awaiting-slots").locator("li")).toHaveCount(3);
      await expect(row.getByText(/^Expires /)).toBeVisible();
      await expect(row.getByRole("link", { name: "See in agenda" })).toHaveAttribute(
        "href",
        `/agenda?date=${firstDay}&highlight=${setup.appointmentId}`,
      );
      await expect(page).toHaveURL(/\/dashboard(?:[?#]|$)/);
    } finally {
      await setup.admin.from("appointments").delete().eq("id", setup.appointmentId);
    }
  });

  test("Awaiting-patient page shows the held times and opens the agenda on their day", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await createRequest("AwaitPage");
    const { firstDay } = await makeProposal(setup);
    try {
      await page.setViewportSize({ width: 1280, height: 900 });
      await signInDoctorOrFail(page, undefined, {
        email: setup.doctorEmail,
        password: setup.doctorPassword,
      });
      await page.goto(`/dashboard/appointments/${setup.appointmentId}?from=dashboard`, {
        waitUntil: "domcontentloaded",
      });

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        `Waiting for ${setup.patientName} to pick a time`,
        { timeout: 20_000 },
      );
      await expect(page.getByTestId("review-proposed-times").locator("li")).toHaveCount(3);
      await expect(page.getByRole("link", { name: "Open in agenda" })).toHaveAttribute(
        "href",
        `/agenda?date=${firstDay}&highlight=${setup.appointmentId}`,
      );
      await expect(page.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/dashboard");
    } finally {
      await setup.admin.from("appointments").delete().eq("id", setup.appointmentId);
    }
  });
});
