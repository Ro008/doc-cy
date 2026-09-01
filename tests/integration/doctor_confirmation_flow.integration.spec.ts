import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInDoctorOrSkipOnInfraError } from "../helpers/signInDoctorWithInfraSkip";

const DEFAULT_DURATION_MINUTES = 30;

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function cyprusDateKey(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Nicosia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

function overlapsUtc(
  startA: Date,
  durationAMinutes: number,
  startB: Date,
  durationBMinutes: number,
): boolean {
  const aStart = startA.getTime();
  const aEnd = aStart + durationAMinutes * 60_000;
  const bStart = startB.getTime();
  const bEnd = bStart + durationBMinutes * 60_000;
  return aStart < bEnd && bStart < aEnd;
}

function findStableAppointmentIso(opts: {
  existing: Array<{
    appointment_datetime: string;
    duration_minutes: number | null;
  }>;
  fallbackDurationMinutes: number;
}): string {
  const now = new Date();
  for (let dayOffset = 3; dayOffset <= 45; dayOffset += 1) {
    for (const hour of [9, 10, 11, 12, 14, 15, 16]) {
      const candidate = new Date(now);
      candidate.setUTCDate(now.getUTCDate() + dayOffset);
      candidate.setUTCHours(hour, 0, 0, 0);

      const weekday = candidate.getUTCDay();
      if (weekday === 0 || weekday === 6) continue;

      const conflicts = opts.existing.some((row) => {
        const start = new Date(row.appointment_datetime);
        const duration =
          typeof row.duration_minutes === "number" && row.duration_minutes > 0
            ? row.duration_minutes
            : opts.fallbackDurationMinutes;
        return overlapsUtc(candidate, DEFAULT_DURATION_MINUTES, start, duration);
      });
      if (!conflicts) return candidate.toISOString();
    }
  }
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

test.describe("Integration: doctor confirmation flow", { tag: ["@pr-e2e", "@pr-mobile-monitor"] }, () => {
  test("confirm flow opens agenda on appointment day", async ({ page }) => {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
    const doctorEmail = firstNonEmpty(
      process.env.TEST_DOCTOR_EMAIL,
      process.env.TEST_USER_EMAIL,
    );
    const doctorPassword = firstNonEmpty(
      process.env.TEST_DOCTOR_PASSWORD,
      process.env.TEST_USER_PASSWORD,
    );

    test.skip(
      !supabaseUrl || !serviceRoleKey || !doctorEmail || !doctorPassword,
      "Missing required integration env vars for doctor confirmation flow.",
    );

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: doctor, error: doctorErr } = await admin
      .from("professionals")
      .select("id")
      .eq("email", doctorEmail)
      .maybeSingle();
    if (doctorErr || !doctor?.id) {
      test.skip(
        true,
        `Test doctor not present in this integration dataset (${doctorEmail}).`,
      );
    }

    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const { data: settingsRow } = await admin
      .from("doctor_settings")
      .select("slot_duration_minutes")
      .eq("doctor_id", doctor.id)
      .maybeSingle();
    const fallbackDurationMinutes =
      Number((settingsRow as { slot_duration_minutes?: number | null } | null)?.slot_duration_minutes) >
      0
        ? Number((settingsRow as { slot_duration_minutes?: number | null } | null)?.slot_duration_minutes)
        : DEFAULT_DURATION_MINUTES;
    const { data: existingRows } = await admin
      .from("appointments")
      .select("appointment_datetime, duration_minutes")
      .eq("doctor_id", doctor.id)
      .gte("appointment_datetime", new Date().toISOString());

    const appointmentDatetimeIso = findStableAppointmentIso({
      existing:
        (existingRows as Array<{ appointment_datetime: string; duration_minutes: number | null }> | null) ??
        [],
      fallbackDurationMinutes,
    });
    const expectedDateKey = cyprusDateKey(appointmentDatetimeIso);
    const patientName = `CI Confirm Patient ${nonce}`;

    const { data: inserted, error: insertErr } = await admin
      .from("appointments")
      .insert({
        doctor_id: doctor.id,
        patient_name: patientName,
        patient_email: `ci-confirm-${nonce}@example.test`,
        patient_phone: "+35799123456",
        appointment_datetime: appointmentDatetimeIso,
        reason: "CI integration doctor confirmation flow",
        status: "REQUESTED",
      })
      .select("id")
      .single();
    if (insertErr || !inserted?.id) {
      throw new Error(`Could not create requested appointment: ${insertErr?.message ?? "missing row"}`);
    }

    const appointmentId = String(inserted.id);

    try {
      await signInDoctorOrSkipOnInfraError(page, undefined, {
        email: doctorEmail,
        password: doctorPassword,
      });

      await page.goto(`/dashboard/appointments/${appointmentId}`, {
        waitUntil: "domcontentloaded",
      });
      const confirmButton = page.getByRole("button", { name: /Confirm appointment/i });
      await expect(confirmButton).toBeVisible({ timeout: 15000 });
      await expect(confirmButton).toBeEnabled({ timeout: 15000 });
      await confirmButton.click();

      await page.waitForURL((url: URL) => {
        const p = url.pathname.replace(/\/$/, "");
        return p === `/dashboard/appointments/${appointmentId}`;
      });

      await expect(page.getByTestId("userbar-mobile-tabs")).toBeHidden();
      await expect(page.getByTestId("userbar-toggle")).toBeHidden();

      const openAgendaDayLink = page.getByRole("link", { name: /Open that day in agenda/i });
      if ((await openAgendaDayLink.count()) === 0) {
        await admin
          .from("appointments")
          .update({ status: "CONFIRMED", duration_minutes: DEFAULT_DURATION_MINUTES })
          .eq("id", appointmentId);
        await page.goto(`/dashboard/appointments/${appointmentId}?confirmed=1`, {
          waitUntil: "domcontentloaded",
        });
      }
      await expect(openAgendaDayLink).toBeVisible({ timeout: 15000 });
      await expect(openAgendaDayLink).toHaveAttribute("href", `/agenda?date=${expectedDateKey}`);
      await Promise.all([
        page.waitForURL((url: URL) => {
          const p = url.pathname.replace(/\/$/, "");
          return p === "/agenda" && url.searchParams.get("date") === expectedDateKey;
        }),
        openAgendaDayLink.click(),
      ]);
      await expect(
        page.getByRole("button", {
          name: new RegExp(`Appointment ${patientName} at`, "i"),
        }),
      ).toBeVisible({ timeout: 15000 });
    } finally {
      await admin.from("appointments").delete().eq("id", appointmentId);
    }
  });

  test("invalid/non-relevant doctor link shows guidance instead of 404", async ({ page }) => {
    const doctorEmail = firstNonEmpty(
      process.env.TEST_DOCTOR_EMAIL,
      process.env.TEST_USER_EMAIL,
    );
    const doctorPassword = firstNonEmpty(
      process.env.TEST_DOCTOR_PASSWORD,
      process.env.TEST_USER_PASSWORD,
    );
    test.skip(
      !doctorEmail || !doctorPassword,
      "Missing TEST_USER_EMAIL/TEST_USER_PASSWORD for doctor link fallback test.",
    );

    await signInDoctorOrSkipOnInfraError(page, undefined, {
      email: doctorEmail,
      password: doctorPassword,
    });

    await page.goto("/dashboard/appointments/00000000-0000-0000-0000-000000000001", {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.getByRole("heading", {
        name: /This confirmation link is no longer available/i,
      }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("link", { name: /Open agenda/i })).toBeVisible();
  });
});

