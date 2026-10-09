import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "../lib/appointments";
import { signInDoctorAndSetCookies } from "./helpers/doctorAuth";

/** Service role: with a cached session the sign-in helper never signs in a client of ours. */
async function getDoctorId(
  admin: SupabaseClient,
  authUserId: string,
): Promise<string> {
  const { data } = await admin
    .from("professionals")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("is_registered", true)
    .single();
  const doctorId = (data as { id?: string } | null)?.id;
  expect(doctorId).toBeTruthy();
  return doctorId as string;
}

async function seedRequestedAppointment(
  admin: SupabaseClient,
  doctorId: string,
  label: string,
): Promise<string> {
  const nonce = Date.now().toString().slice(-6);
  const appointmentUtc = zonedTimeToUtc("2030-04-11T11:00", CY_TZ as string);
  const inserted = await admin
    .from("appointments")
    .insert({
      professional_id: doctorId,
      patient_name: `${label} ${nonce}`,
      patient_email: `${label.toLowerCase()}.${nonce}@integration.test`,
      patient_phone: "+35799123456",
      appointment_datetime: appointmentUtc.toISOString(),
      status: "REQUESTED",
      reason: `E2E feedback matrix ${label}`,
    })
    .select("id")
    .single();
  expect(inserted.error).toBeNull();
  expect(inserted.data?.id).toBeTruthy();
  return inserted.data!.id as string;
}

async function seedAgendaAppointment(
  admin: SupabaseClient,
  doctorId: string,
  status: "REQUESTED" | "CONFIRMED",
  label: string,
): Promise<{ id: string; patientName: string }> {
  const nonce = Date.now().toString().slice(-6);
  const patientName = `${label} ${nonce}`;
  const appointmentUtc = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const inserted = await admin
    .from("appointments")
    .insert({
      professional_id: doctorId,
      patient_name: patientName,
      patient_email: `${label.toLowerCase()}.${nonce}@integration.test`,
      patient_phone: "+35799123456",
      appointment_datetime: appointmentUtc.toISOString(),
      status,
      reason: `E2E feedback matrix ${label}`,
    })
    .select("id")
    .single();
  expect(inserted.error).toBeNull();
  expect(inserted.data?.id).toBeTruthy();
  return { id: inserted.data!.id as string, patientName };
}

test.describe("Feedback matrix toasts", () => {
  test.describe.configure({ mode: "serial" });

  test("doctor confirm success shows post-confirm summary", async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Feedback matrix is stabilized for desktop run.",
    );
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    expect(supabaseUrl).not.toBe("");
    expect(anonKey).not.toBe("");
    expect(serviceKey).not.toBe("");

    const anon = createClient(supabaseUrl, anonKey);
    const admin = createClient(supabaseUrl, serviceKey);

    const { authUserId } = await signInDoctorAndSetCookies(page, anon);
    const doctorId = await getDoctorId(admin, authUserId);
    const appointmentId = await seedRequestedAppointment(
      admin,
      doctorId,
      "MatrixSuccess",
    );

    try {
      await page.route(
        new RegExp(`/api/appointments/${appointmentId}/overlap\\?`),
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ hasConflict: false }),
          });
        },
      );
      await page.goto(`/dashboard/appointments/${appointmentId}`);
      // "Confirm Thu 11 Apr, 11:00–11:30"
      const confirmBtn = page.getByRole("button", { name: /^Confirm (Mon|Tue|Wed|Thu|Fri|Sat|Sun) /i });
      await expect(confirmBtn).toBeEnabled({ timeout: 15_000 });
      await confirmBtn.click();
      await expect(page).toHaveURL(
        new RegExp(
          `/dashboard/appointments/${appointmentId}\\?confirmed=1(?:$|[&#])`,
        ),
        { timeout: 15_000 },
      );
      await expect(
        page.getByText(/The visit is in your agenda and the patient has been emailed/i),
      ).toBeVisible({ timeout: 12_000 });
    } finally {
      await admin.from("appointments").delete().eq("id", appointmentId);
    }
  });

  test("doctor confirm error shows error toast", async ({ page }, testInfo) => {
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Feedback matrix is stabilized for desktop run.",
    );
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const anon = createClient(supabaseUrl, anonKey);
    const admin = createClient(supabaseUrl, serviceKey);

    const { authUserId } = await signInDoctorAndSetCookies(page, anon);
    const doctorId = await getDoctorId(admin, authUserId);
    const appointmentId = await seedRequestedAppointment(admin, doctorId, "MatrixError");

    try {
      await page.route(
        new RegExp(`/api/appointments/${appointmentId}/overlap\\?`),
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ hasConflict: false }),
          });
        },
      );
      await page.route(
        new RegExp(`/api/appointments/${appointmentId}/confirm$`),
        async (route) => {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "Could not confirm this appointment." }),
          });
        },
      );

      await page.goto(`/dashboard/appointments/${appointmentId}`);
      const confirmBtn = page.getByRole("button", { name: /^Confirm (Mon|Tue|Wed|Thu|Fri|Sat|Sun) /i });
      await expect(confirmBtn).toBeEnabled({ timeout: 15_000 });
      await confirmBtn.click();
      await expect(
        page
          .locator("[data-sonner-toast]")
          .getByText(/Could not confirm this appointment\./i),
      ).toBeVisible({ timeout: 8_000 });
    } finally {
      await admin.from("appointments").delete().eq("id", appointmentId);
    }
  });

  test("online bookings toggle shows toast feedback", async ({ page }, testInfo) => {
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Feedback matrix is stabilized for desktop run.",
    );
    test.setTimeout(60_000);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const anon = createClient(supabaseUrl, anonKey);
    await signInDoctorAndSetCookies(page, anon);

    await page.route("**/api/doctor-online-bookings", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/agenda");
    const toggle = page.getByRole("switch").first();
    const toggleCount = await page.getByRole("switch").count();
    testInfo.skip(
      toggleCount === 0,
      "Online bookings toggle is not present for this doctor seed.",
    );
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await toggle.click();
    await expect(
      page
        .locator("[data-sonner-toast]")
        .getByText(/Online bookings paused\.|Online bookings resumed\./i),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("settings save shows success toast", async ({ page }, testInfo) => {
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Feedback matrix is stabilized for desktop run.",
    );
    test.setTimeout(60_000);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const anon = createClient(supabaseUrl, anonKey);
    await signInDoctorAndSetCookies(page, anon);

    await page.route("**/api/doctor-settings", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/settings");
    // Booking limits save the moment they change (one save rule, no page-wide Save).
    const notice = page.locator("#minimumNoticeHours");
    const current = await notice.inputValue();
    await notice.selectOption(current === "24" ? "48" : "24");
    await expect(
      page.locator("[data-sonner-toast]").getByText(/Booking limits saved\./i),
    ).toBeVisible({
      timeout: 8_000,
    });
  });

  test("agenda decline requested shows success toast", async ({ page }, testInfo) => {
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Feedback matrix is stabilized for desktop run.",
    );
    test.setTimeout(90_000);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const anon = createClient(supabaseUrl, anonKey);
    const admin = createClient(supabaseUrl, serviceKey);
    const { authUserId } = await signInDoctorAndSetCookies(page, anon);
    const doctorId = await getDoctorId(admin, authUserId);
    const seeded = await seedAgendaAppointment(
      admin,
      doctorId,
      "REQUESTED",
      "MatrixDecline",
    );

    try {
      await page.route(
        new RegExp(`/api/appointments/${seeded.id}/reject$`),
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true }),
          });
        },
      );

      await page.goto("/agenda");
      const appt = page
        .getByRole("button", {
          name: new RegExp(`Appointment\\s+${seeded.patientName}`, "i"),
        })
        .first();
      await expect(appt).toBeVisible({ timeout: 12_000 });
      await appt.click();

      await page.getByRole("button", { name: /Decline request/i }).click();
      await page
        .getByPlaceholder(/e\.g\./i)
        .fill("Matrix decline reason for automated test.");
      await page.getByRole("button", { name: /Decline & notify/i }).click();

      await expect(
        page
          .locator("[data-sonner-toast]")
          .getByText(/request was removed from your agenda/i),
      ).toBeVisible({ timeout: 8_000 });
    } finally {
      await admin.from("appointments").delete().eq("id", seeded.id);
    }
  });

  test("agenda cancel confirmed shows success toast", async ({ page }, testInfo) => {
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Feedback matrix is stabilized for desktop run.",
    );
    test.setTimeout(90_000);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const anon = createClient(supabaseUrl, anonKey);
    const admin = createClient(supabaseUrl, serviceKey);
    const { authUserId } = await signInDoctorAndSetCookies(page, anon);
    const doctorId = await getDoctorId(admin, authUserId);
    const seeded = await seedAgendaAppointment(
      admin,
      doctorId,
      "CONFIRMED",
      "MatrixCancel",
    );

    try {
      await page.route(
        new RegExp(`/api/appointments/${seeded.id}/cancel-confirmed$`),
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true }),
          });
        },
      );

      await page.goto("/agenda");
      const appt = page
        .getByRole("button", {
          name: new RegExp(`Appointment\\s+${seeded.patientName}`, "i"),
        })
        .first();
      await expect(appt).toBeVisible({ timeout: 12_000 });
      await appt.click();

      await page.getByRole("button", { name: /Cancel appointment/i }).click();
      await page
        .getByPlaceholder(/e\.g\./i)
        .fill("Matrix cancel reason for automated test.");
      await page.getByRole("button", { name: /Cancel & notify/i }).click();

      await expect(
        page
          .locator("[data-sonner-toast]")
          .getByText(/visit was removed from your agenda/i),
      ).toBeVisible({ timeout: 8_000 });
    } finally {
      await admin.from("appointments").delete().eq("id", seeded.id);
    }
  });
});
