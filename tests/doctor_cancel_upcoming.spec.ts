// tests/doctor_cancel_upcoming.spec.ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInDoctorAndSetCookies } from "./helpers/doctorAuth";
import { skipIfSafeNoBooking } from "./helpers/safeMode";
import { zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "../lib/appointments";

function nextWorkingDayCyprus(now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  // 0=Sun,1=Mon,...,6=Sat — we want Mon–Fri
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

test.describe("Upcoming appointments cancellation @booking-creates", () => {
  test.beforeEach(({}, testInfo) => {
    if (
      testInfo.project.name === "Mobile Safari (iPhone 12)" ||
      testInfo.project.name === "Tablet (iPad)"
    ) {
      testInfo.skip(
        true,
        "Supabase auth redirect to /agenda is flaky on WebKit mobile for E2E."
      );
    }
  });

  test("doctor can cancel a future appointment from Upcoming list", async ({
    page,
    request,
  }) => {
    skipIfSafeNoBooking(test.info());

    test.setTimeout(60000);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    expect(supabaseUrl).not.toBe("");
    expect(supabaseAnonKey).not.toBe("");

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { authUserId } = await signInDoctorAndSetCookies(page, supabase);

    const { data: doctorRow } = await supabase
      .from("doctors")
      .select("slug,id")
      .eq("auth_user_id", authUserId)
      .eq("status", "verified")
      .single();
    const slug = (doctorRow as { slug?: string } | null)?.slug;
    expect(slug).toBeTruthy();

    const patientName = "Cancel E2E Future";
    const patientEmail = "cancel.future@example.com";
    const patientPhone = "+35799123456";
    const visitType = "Follow-up";

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const admin = serviceKey ? createClient(supabaseUrl, serviceKey) : null;
    const doctorId = (doctorRow as { id?: string } | null)?.id;
    test.skip(!doctorId, "Could not resolve doctor id for seeding.");

    let seeded = false;
    let appointmentId: string | undefined = undefined;

    // Try multiple future working days/time slots to avoid flaky
    // `doctor_settings` states (holiday range and/or pause_online_bookings).
    const candidateTimes = ["16:30", "16:45", "17:00", "17:30", "18:00"];

    outer: for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      const candidateBase = new Date();
      candidateBase.setDate(candidateBase.getDate() + dayOffset);

      const dateStr = nextWorkingDayCyprus(candidateBase);

      for (const hhmm of candidateTimes) {
        const appointmentLocal = `${dateStr}T${hhmm}`;

        const createRes = await request.post("/api/appointments", {
          data: {
            doctorSlug: slug,
            patientName,
            patientEmail,
            patientPhone,
            appointmentLocal,
            visitType,
          },
        });

        if (createRes.ok()) {
          const createJson = await createRes.json().catch(() => null);
          appointmentId = createJson?.appointment?.id as
            | string
            | undefined;
          seeded = true;
          break outer;
        }

        if (createRes.status() === 409) {
          // Slot already taken: try another time.
          continue;
        }

        if (createRes.status() === 403) {
          const body = await createRes.text().catch(() => "");
          const isBookingsTemporarilyUnavailable = body.includes(
            "Bookings temporarily unavailable",
          );

          if (isBookingsTemporarilyUnavailable && admin) {
            // As a fallback, seed directly with service role (best-effort).
            // This removes dependency on paused/holiday settings.
            const candidateUtc = zonedTimeToUtc(
              appointmentLocal,
              CY_TZ as string
            );

            const insertRes = await admin
              .from("appointments")
              .insert({
                doctor_id: doctorId,
                patient_name: patientName,
                patient_email: patientEmail,
                patient_phone: patientPhone,
                appointment_datetime: candidateUtc.toISOString(),
                status: "confirmed",
                visit_type: visitType,
                visit_notes: null,
              })
              .select("id")
              .single();

            if (!insertRes.error) {
              appointmentId = insertRes.data?.id as string | undefined;
              seeded = true;
              break outer;
            }
          }

          // Otherwise: try another day/time slot.
          continue;
        }

        const body = await createRes.text().catch(() => "");
        throw new Error(
          `Failed to seed future appointment: ${createRes.status()} ${body}`
        );
      }
    }

    test.skip(!seeded, "Could not seed a future appointment (bookings temporarily unavailable).");

    // 2. Visit dashboard and locate the appointment in "Upcoming on other days"
    await page.goto("/agenda");

    await expect(page.getByText(/Your Agenda · Today/i)).toBeVisible({
      timeout: 10000,
    });

    const upcomingSection = page
      .getByRole("heading", { name: /Upcoming on other days/i })
      .locator("..")
      .locator("..");

    // Take the first Cancel button in the Upcoming list
    const cancelButton = upcomingSection
      .getByRole("button", { name: /^Cancel$/i })
      .first();
    await expect(cancelButton).toBeVisible({ timeout: 10000 });
    await expect(cancelButton).toBeEnabled();
    await cancelButton.click();

    // Confirm cancellation in the modal
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 });

    const confirmBtn = dialog.getByRole("button", {
      name: /Confirm cancel/i,
    });
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await confirmBtn.click();

    // 3. After backend cancel, UI reloads; ensure the cancelled appointment is gone.
    // UpcomingList uses `window.location.reload()` after a successful cancel.
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(patientName)).toHaveCount(0);

    if (appointmentId) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
      if (serviceKey) {
        const admin = createClient(supabaseUrl, serviceKey);
        await admin.from("appointments").delete().eq("id", appointmentId);
      }
    }
  });
});

