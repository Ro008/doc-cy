import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInDoctorOrSkipOnInfraError } from "../helpers/signInDoctorWithInfraSkip";

const DEFAULT_DURATION_MINUTES = 30;
const REASON =
  "Urgent procedure came up — please pick one of the proposed times (integration test).";

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
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

test.describe("Integration: propose reschedule (confirmed visit)", () => {
  test("doctor can send reschedule proposal for CONFIRMED appointment", async ({
    page,
  }) => {
    const baseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "").trim();
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
      !baseUrl || !supabaseUrl || !serviceRoleKey || !doctorEmail || !doctorPassword,
      "Missing integration env for propose-reschedule test.",
    );

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: doctor, error: doctorErr } = await admin
      .from("doctors")
      .select("id")
      .eq("email", doctorEmail)
      .maybeSingle();
    if (doctorErr || !doctor?.id) {
      test.skip(true, `Test doctor not in dataset (${doctorEmail}).`);
    }

    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const { data: settingsRow } = await admin
      .from("doctor_settings")
      .select("slot_duration_minutes")
      .eq("doctor_id", doctor.id)
      .maybeSingle();
    const fallbackDurationMinutes =
      Number(
        (settingsRow as { slot_duration_minutes?: number | null } | null)
          ?.slot_duration_minutes,
      ) > 0
        ? Number(
            (settingsRow as { slot_duration_minutes?: number | null } | null)
              ?.slot_duration_minutes,
          )
        : DEFAULT_DURATION_MINUTES;

    const { data: existingRows } = await admin
      .from("appointments")
      .select("appointment_datetime, duration_minutes")
      .eq("doctor_id", doctor.id)
      .gte("appointment_datetime", new Date().toISOString());

    const appointmentDatetimeIso = findStableAppointmentIso({
      existing:
        (existingRows as Array<{
          appointment_datetime: string;
          duration_minutes: number | null;
        }> | null) ?? [],
      fallbackDurationMinutes,
    });

    const { data: inserted, error: insertErr } = await admin
      .from("appointments")
      .insert({
        doctor_id: doctor.id,
        patient_name: `CI Reschedule ${nonce}`,
        patient_email: `ci-reschedule-${nonce}@example.test`,
        patient_phone: "+35799123456",
        appointment_datetime: appointmentDatetimeIso,
        reason: "Integration — confirmed visit reschedule proposal",
        status: "CONFIRMED",
        duration_minutes: DEFAULT_DURATION_MINUTES,
        is_new_patient: false,
      })
      .select("id")
      .single();

    if (insertErr || !inserted?.id) {
      throw new Error(
        `Could not seed CONFIRMED appointment: ${insertErr?.message ?? "missing row"}`,
      );
    }

    const appointmentId = String(inserted.id);

    try {
      await signInDoctorOrSkipOnInfraError(page, undefined, {
        email: doctorEmail,
        password: doctorPassword,
      });

      const altRes = await page.request.get(
        `/api/appointments/${encodeURIComponent(appointmentId)}/alternative-slots?durationMinutes=${DEFAULT_DURATION_MINUTES}`,
      );
      const altBodyText = await altRes.text();
      expect(
        altRes.ok(),
        `alternative-slots failed: ${altRes.status()} ${altBodyText}`,
      ).toBeTruthy();
      const altJson = JSON.parse(altBodyText) as { slots?: string[] };
      expect((altJson as { slots?: string[] }).slots?.length ?? 0).toBeGreaterThanOrEqual(
        3,
      );

      const proposeRes = await page.request.post(
        `/api/appointments/${encodeURIComponent(appointmentId)}/propose-reschedule`,
        {
          data: {
            durationMinutes: DEFAULT_DURATION_MINUTES,
            rescheduleReason: REASON,
          },
        },
      );

      const proposeJson = await proposeRes.json().catch(() => ({}));
      expect(
        proposeRes.ok(),
        `propose-reschedule failed: ${proposeRes.status()} ${JSON.stringify(proposeJson)}`,
      ).toBeTruthy();
      expect(proposeJson).toMatchObject({ message: "Proposal sent to the patient." });
      expect(Array.isArray((proposeJson as { slots?: unknown }).slots)).toBe(true);
      expect((proposeJson as { slots: string[] }).slots.length).toBe(3);

      const { data: updated, error: readErr } = await admin
        .from("appointments")
        .select(
          "status, duration_minutes, proposed_slots, proposal_expires_at, reschedule_access_token",
        )
        .eq("id", appointmentId)
        .single();

      expect(readErr).toBeNull();
      expect(String(updated?.status ?? "").toUpperCase()).toBe("NEEDS_RESCHEDULE");
      expect(
        Array.isArray(updated?.proposed_slots) ? updated.proposed_slots.length : 0,
      ).toBe(3);
      expect(updated?.proposal_expires_at).toBeTruthy();
      expect(updated?.reschedule_access_token).toBeTruthy();
    } finally {
      await admin.from("appointments").delete().eq("id", appointmentId);
    }
  });
});
