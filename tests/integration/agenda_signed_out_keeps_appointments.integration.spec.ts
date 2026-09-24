import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { addDays, format } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";

import { CY_TZ } from "@/lib/appointments";
import {
  createTestDoctor,
  deleteTestDoctor,
  loginDoctorUi,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

/**
 * A professional whose session lapses must not see an empty agenda.
 *
 * Without a session the browser's PostgREST read runs as `anon`, and RLS
 * answers `200 []` rather than an error. The agenda used to take that as the
 * truth and wipe every appointment off the screen, which reads as "my bookings
 * are gone". It must keep what it has and say the professional is signed out.
 */

function signedOutNotice(page: Page) {
  return page.getByRole("alert").filter({ hasText: /signed out/i });
}

function supabaseAuthCookiePrefix(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

/** Waits for the agenda's own appointments read after nudging it to refresh. */
async function triggerAgendaRefresh(page: Page): Promise<void> {
  const read = page.waitForResponse(
    (res) => res.url().includes("/rest/v1/appointments") && res.request().method() === "GET",
    { timeout: 20_000 },
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await read;
}

test.describe("Agenda keeps appointments when signed out", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
  let fixture: TestDoctorFixture | null = null;
  let dayKey = "";
  let patientName = "";

  test.beforeAll(async () => {
    const nonce = `lapse${Date.now()}`.slice(-12);
    fixture = await createTestDoctor({
      admin,
      nonce,
      name: `Lapse Doctor ${nonce.slice(-4)}`,
      specialty: "Cardiology",
      is_specialty_approved: true,
      status: "verified",
    });

    // Tomorrow, 10:00 Cyprus time: always in the future, always inside the grid.
    dayKey = format(addDays(utcToZonedTime(new Date(), CY_TZ), 1), "yyyy-MM-dd");
    patientName = `Lapse Patient ${nonce.slice(-5)}`;
    const inserted = await admin.from("appointments").insert({
      doctor_id: fixture.doctorId,
      patient_name: patientName,
      patient_email: `signed-out-${nonce}@integration.test`,
      patient_phone: "99123456",
      appointment_datetime: zonedTimeToUtc(`${dayKey}T10:00`, CY_TZ).toISOString(),
      status: "CONFIRMED",
      reason: "Signed-out agenda test",
    });
    expect(inserted.error).toBeNull();
  });

  test.afterAll(async () => {
    if (!fixture) return;
    await admin.from("appointments").delete().eq("doctor_id", fixture.doctorId);
    await deleteTestDoctor(fixture);
  });

  test("a signed-in professional's agenda refreshes without a signed-out notice", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginDoctorUi(page, fixture!.email, fixture!.password);
    await page.goto(`/agenda?date=${dayKey}`);

    const card = page.locator("button:visible", { hasText: patientName }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });

    await triggerAgendaRefresh(page);
    await expect(card).toBeVisible();
    await expect(signedOutNotice(page)).toHaveCount(0);
  });

  test("a lapsed session keeps the appointments and says the professional is signed out", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginDoctorUi(page, fixture!.email, fixture!.password);
    await page.goto(`/agenda?date=${dayKey}`);

    const card = page.locator("button:visible", { hasText: patientName }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });

    // The session lapses in the open tab: its auth cookies are gone.
    const prefix = supabaseAuthCookiePrefix();
    const context = page.context();
    const kept = (await context.cookies()).filter((c) => !c.name.startsWith(prefix));
    await context.clearCookies();
    await context.addCookies(kept);

    // No waiting for the read here: without a session the agenda may skip it.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));

    const notice = signedOutNotice(page);
    await expect(notice).toBeVisible({ timeout: 20_000 });
    await expect(card).toBeVisible();
    await expect(notice.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      /\/login\?next=(%2F|\/)agenda/,
    );
  });
});
