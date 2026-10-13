import { expect, test, type Page } from "@playwright/test";
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

/** A free weekday slot a few days out, so the request does not clash with another booking. */
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
async function waitForHydration(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-doccy-pro-chrome-hydrated", "1", {
    timeout: 20_000,
  });
}

type Setup = {
  admin: SupabaseClient;
  doctorId: string;
  doctorEmail: string;
  doctorPassword: string;
  createdIds: string[];
};

async function setupOrSkip(): Promise<Setup> {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const doctorEmail = firstNonEmpty(process.env.TEST_DOCTOR_EMAIL, process.env.TEST_USER_EMAIL);
  const doctorPassword = firstNonEmpty(process.env.TEST_DOCTOR_PASSWORD, process.env.TEST_USER_PASSWORD);
  test.skip(
    !supabaseUrl || !serviceRoleKey || !doctorEmail || !doctorPassword,
    "Missing required integration env vars for the new requests bar.",
  );
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: doctor } = await admin.from("professionals").select("id").eq("email", doctorEmail).maybeSingle();
  test.skip(!doctor?.id, `Test doctor not present in this dataset (${doctorEmail}).`);
  return { admin, doctorId: String(doctor!.id), doctorEmail, doctorPassword, createdIds: [] };
}

/** A request as the patient's email confirmation creates it. */
async function insertRequest(setup: Setup, label: string): Promise<{ id: string; patientName: string }> {
  const { data: existing } = await setup.admin
    .from("appointments")
    .select("appointment_datetime, duration_minutes")
    .eq("professional_id", setup.doctorId)
    .gte("appointment_datetime", new Date().toISOString());
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const patientName = `CI New Bar ${label} ${nonce}`;
  const { data, error } = await setup.admin
    .from("appointments")
    .insert({
      professional_id: setup.doctorId,
      patient_name: patientName,
      patient_email: `ci-new-bar-${nonce}@example.test`,
      patient_phone: "+35799123456",
      appointment_datetime: findFreeSlotIso(existing ?? []),
      duration_minutes: DEFAULT_DURATION_MINUTES,
      reason: "CI integration new requests bar",
      status: "REQUESTED",
    })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(`Could not create request: ${error?.message ?? "missing row"}`);
  setup.createdIds.push(String(data.id));
  return { id: String(data.id), patientName };
}

async function openDashboard(page: Page, setup: Setup) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signInDoctorOrFail(page, undefined, { email: setup.doctorEmail, password: setup.doctorPassword });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await waitForHydration(page);
}

async function cleanup(setup: Setup | null) {
  if (setup && setup.createdIds.length > 0) {
    await setup.admin.from("appointments").delete().in("id", setup.createdIds);
  }
}

test.describe("Integration: dashboard new requests bar", { tag: ["@pr-e2e", "@pr-e2e-booking"] }, () => {
  test("a request arriving live shows the bar, and Show brings it in highlighted", async ({ page }) => {
    test.setTimeout(150_000);
    let setup: Setup | null = null;
    try {
      setup = await setupOrSkip();
      await openDashboard(page, setup);
      const section = page.locator("#needs-your-answer");
      await expect(section).toHaveAttribute("data-new-requests-live", "1", { timeout: 20_000 });
      await expect(page.getByTestId("dashboard-new-requests-bar")).toHaveCount(0);

      const request = await insertRequest(setup, "Live");
      const bar = page.getByTestId("dashboard-new-requests-bar");
      await expect(bar).toContainText(/\d+ new requests?/, { timeout: 20_000 });

      // The row waits for Show, so nothing moves under her finger.
      const card = page.getByTestId("dashboard-pending-request").filter({ hasText: request.patientName });
      await expect(card).toHaveCount(0);

      await bar.getByRole("button", { name: "Show" }).click();
      await expect(card).toBeVisible({ timeout: 20_000 });
      await expect(card).toHaveAttribute("data-highlighted", "true");
      await expect(bar).toHaveCount(0);
    } finally {
      await cleanup(setup);
    }
  });

  test("a request handled elsewhere takes the bar away again", async ({ page }) => {
    test.setTimeout(150_000);
    let setup: Setup | null = null;
    try {
      setup = await setupOrSkip();
      await openDashboard(page, setup);
      await expect(page.locator("#needs-your-answer")).toHaveAttribute("data-new-requests-live", "1", {
        timeout: 20_000,
      });

      const request = await insertRequest(setup, "Handled");
      const bar = page.getByTestId("dashboard-new-requests-bar");
      await expect(bar).toBeVisible({ timeout: 20_000 });

      await setup.admin.from("appointments").update({ status: "DECLINED" }).eq("id", request.id);
      await expect(bar).toHaveCount(0, { timeout: 20_000 });
    } finally {
      await cleanup(setup);
    }
  });

  test("without Realtime, the count check still shows the bar", async ({ page }) => {
    test.setTimeout(150_000);
    let setup: Setup | null = null;
    try {
      setup = await setupOrSkip();
      // Realtime runs over a websocket: refuse it, as a sleeping laptop or a dropped connection would.
      await page.routeWebSocket(/\/realtime\/v1\//, (ws) => ws.close());
      await openDashboard(page, setup);
      await expect(page.getByTestId("dashboard-pending-request").first().or(page.getByText("All caught up")))
        .toBeVisible({ timeout: 20_000 });

      const request = await insertRequest(setup, "Poll");
      // Coming back to the window checks the count straight away instead of waiting a minute.
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      const bar = page.getByTestId("dashboard-new-requests-bar");
      await expect(bar).toContainText(/\d+ new requests?/, { timeout: 20_000 });

      await bar.getByRole("button", { name: "Show" }).click();
      const card = page.getByTestId("dashboard-pending-request").filter({ hasText: request.patientName });
      await expect(card).toBeVisible({ timeout: 20_000 });
      await expect(card).toHaveAttribute("data-highlighted", "true");
    } finally {
      await cleanup(setup);
    }
  });
});
