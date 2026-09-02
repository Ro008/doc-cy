import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildWeeklyScheduleFromSettings,
  type DoctorSettingsRow,
} from "@/lib/doctor-settings";
import {
  buildMonthlyDigestMetrics,
  cyprusMonthReferenceFromKey,
  cyprusPreviousMonthKey,
  monthlyDigestHasActivity,
} from "@/lib/monthly-digest-metrics";
import type { InsightsAppointmentRow } from "@/lib/practice-insights";
import { sendDoctorMonthlyDigestEmail } from "@/lib/send-doctor-monthly-digest-email";
import { getPublicBookingBaseUrl } from "@/lib/site-url";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";

export type MonthlyDigestJobResult = {
  monthKey: string;
  dryRun: boolean;
  doctorsChecked: number;
  sent: number;
  skippedNoActivity: number;
  skippedAlreadySent: number;
  skippedNoEmail: number;
  failed: number;
  errors: { doctorId: string; message: string }[];
};

type DoctorRow = {
  id: string;
  name: string | null;
  email: string | null;
};

const EMAIL_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveMonthKey(explicit?: string | null): string {
  const trimmed = String(explicit ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  return cyprusPreviousMonthKey();
}

async function wasDigestAlreadySent(
  supabase: SupabaseClient,
  doctorId: string,
  monthKey: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("doctor_monthly_digest_sent")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("month_key", monthKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return Boolean(data);
}

async function recordDigestSent(
  supabase: SupabaseClient,
  doctorId: string,
  monthKey: string,
): Promise<void> {
  const { error } = await supabase.from("doctor_monthly_digest_sent").insert({
    doctor_id: doctorId,
    month_key: monthKey,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function runMonthlyDigestJob(opts?: {
  monthKey?: string | null;
  dryRun?: boolean;
  resendToOverride?: string | null;
}): Promise<MonthlyDigestJobResult> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    throw new Error("Missing Supabase service role configuration.");
  }

  const monthKey = resolveMonthKey(opts?.monthKey);
  const dryRun = Boolean(opts?.dryRun);
  const reportMonth = cyprusMonthReferenceFromKey(monthKey);
  const siteUrl = getPublicBookingBaseUrl();

  const result: MonthlyDigestJobResult = {
    monthKey,
    dryRun,
    doctorsChecked: 0,
    sent: 0,
    skippedNoActivity: 0,
    skippedAlreadySent: 0,
    skippedNoEmail: 0,
    failed: 0,
    errors: [],
  };

  const { data: doctors, error: doctorsError } = await fetchAllSupabaseRows(() =>
    supabase
      .from("professionals")
      .select("id, name, email")
      .eq("is_test_profile", false)
      .eq("is_registered", true)
      .not("email", "is", null),
  );

  if (doctorsError) {
    throw new Error(doctorsError.message);
  }

  for (const doctor of (doctors ?? []) as DoctorRow[]) {
    result.doctorsChecked += 1;
    const email = String(doctor.email ?? "").trim();
    if (!email) {
      result.skippedNoEmail += 1;
      continue;
    }

    try {
      if (await wasDigestAlreadySent(supabase, doctor.id, monthKey)) {
        result.skippedAlreadySent += 1;
        continue;
      }

      const { data: appointments, error: apptError } = await fetchAllSupabaseRows(() =>
        supabase
          .from("appointments")
          .select("appointment_datetime, status, created_at")
          .eq("doctor_id", doctor.id),
      );

      if (apptError) {
        throw new Error(apptError.message);
      }

      let weeklySchedule = null;
      const { data: settings, error: settingsError } = await supabase
        .from("doctor_settings")
        .select(
          "doctor_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, weekly_schedule",
        )
        .eq("doctor_id", doctor.id)
        .maybeSingle();

      if (settingsError) {
        throw new Error(settingsError.message);
      }
      if (settings) {
        weeklySchedule = buildWeeklyScheduleFromSettings(settings as DoctorSettingsRow);
      }

      const metrics = buildMonthlyDigestMetrics(
        (appointments ?? []) as InsightsAppointmentRow[],
        weeklySchedule,
        reportMonth,
      );

      if (!monthlyDigestHasActivity(metrics)) {
        result.skippedNoActivity += 1;
        continue;
      }

      if (dryRun) {
        result.sent += 1;
        continue;
      }

      await sendDoctorMonthlyDigestEmail({
        siteUrl,
        doctorEmail: email,
        doctorName: doctor.name ?? "Doctor",
        metrics,
        resendToOverride: opts?.resendToOverride,
      });

      await recordDigestSent(supabase, doctor.id, monthKey);
      result.sent += 1;
      await sleep(EMAIL_DELAY_MS);
    } catch (err) {
      result.failed += 1;
      result.errors.push({
        doctorId: doctor.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
