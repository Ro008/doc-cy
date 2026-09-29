export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";
import { DoctorDashboard } from "@/components/dashboard/DoctorDashboard";
import { CY_TZ } from "@/lib/appointments";
import { locationsToAgendaClinics } from "@/lib/agenda-clinics";
import { firstNameFromProfessionalName } from "@/lib/doctor-display-name";
import {
  DASHBOARD_APPOINTMENT_SELECT,
  DASHBOARD_APPOINTMENT_SELECT_WITH_RESCHEDULE,
  todayWorkingWindow,
  type DashboardAppointmentRow,
} from "@/lib/doctor-dashboard";
import {
  DOCTOR_FIRST_LOGIN_PATH,
  shouldRedirectFirstLoginToSettings,
} from "@/lib/first-login-trial-notice";
import { loadAgendaSettings } from "@/lib/load-agenda-settings";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";

/**
 * Today onwards, plus reschedules waiting on the patient or lapsed without a choice (their
 * original time can be in the past). Tries the `rescheduled_from` column first and falls back
 * while the backend has not added it.
 */
async function loadDashboardAppointments(
  supabase: ReturnType<typeof createServerComponentClient>,
  doctorId: string,
  todayStartUtc: string,
) {
  const query = (select: string) =>
    fetchAllSupabaseRows(() =>
      supabase
        .from("appointments")
        .select(select)
        .eq("doctor_id", doctorId)
        .or(`appointment_datetime.gte."${todayStartUtc}",status.eq.NEEDS_RESCHEDULE`)
        .order("appointment_datetime", { ascending: true }),
    );
  const withColumn = await query(DASHBOARD_APPOINTMENT_SELECT_WITH_RESCHEDULE);
  const missingColumn =
    withColumn.error &&
    ((withColumn.error as { code?: string }).code === "42703" ||
      String(withColumn.error.message ?? "").includes("rescheduled_from"));
  return missingColumn ? query(DASHBOARD_APPOINTMENT_SELECT) : withColumn;
}

export default async function DoctorDashboardPage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?next=/dashboard");
  }

  let doctorRes = await supabase
    .from("professionals")
    .select("id, name, status, slug, trial_notice_seen_at")
    .eq("auth_user_id", user.id)
    .single();

  if (
    doctorRes.error &&
    String(doctorRes.error.message ?? "")
      .toLowerCase()
      .includes("trial_notice_seen_at")
  ) {
    doctorRes = await supabase
      .from("professionals")
      .select("id, name, status, slug")
      .eq("auth_user_id", user.id)
      .single();
  }

  const doctor = doctorRes.data as {
    id: string;
    name: string | null;
    status: string | null;
    slug: string | null;
    trial_notice_seen_at?: string | null;
  } | null;

  if (!doctor) {
    if (doctorRes.error) {
      console.error("[Dashboard] Error fetching doctor for user", doctorRes.error);
    }
    redirect("/agenda");
  }

  if (
    shouldRedirectFirstLoginToSettings({
      status: doctor.status,
      trialNoticeSeenAt: doctor.trial_notice_seen_at,
    })
  ) {
    redirect(DOCTOR_FIRST_LOGIN_PATH);
  }

  const nowMs = Date.now();
  // From the start of today in Cyprus: today's visits plus everything upcoming.
  const todayStartUtc = zonedTimeToUtc(
    `${formatInTimeZone(new Date(nowMs), CY_TZ, "yyyy-MM-dd")}T00:00:00`,
    CY_TZ,
  ).toISOString();

  const [{ data: appointments, error: appointmentsError }, settings, locationRows] =
    await Promise.all([
      loadDashboardAppointments(supabase, doctor.id, todayStartUtc),
      loadAgendaSettings(supabase, doctor.id),
      loadDoctorLocations(doctor.id),
    ]);

  if (appointmentsError) {
    console.error("[Dashboard] Error fetching appointments", appointmentsError);
  }

  const clinics = locationsToAgendaClinics(locationRows);
  const hoursList = clinics.length > 0
    ? clinics.map((clinic) => clinic.hours)
    : settings.workingHours
      ? [settings.workingHours]
      : [];

  // Pausing is per clinic; doctors without clinic rows use the older settings flag.
  const pausedClinicNames = clinics.length > 0
    ? clinics.filter((_, i) => locationRows[i]?.pause_online_bookings).map((clinic) => clinic.name)
    : [];
  const bookingsPaused = clinics.length > 0
    ? { all: pausedClinicNames.length === clinics.length, clinicNames: pausedClinicNames }
    : { all: settings.pauseOnlineBookings, clinicNames: [] };

  return (
    <main className="min-h-screen bg-ink-900 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-clinical-500/[0.04] via-transparent to-transparent" />
      <DoctorDashboard
        doctorId={doctor.id}
        doctorSlug={doctor.slug}
        firstName={firstNameFromProfessionalName(doctor.name)}
        appointments={(appointments ?? []) as DashboardAppointmentRow[]}
        workingHours={settings.workingHours}
        clinics={clinics}
        todayWindow={todayWorkingWindow(hoursList, nowMs)}
        bookingsPaused={bookingsPaused}
      />
    </main>
  );
}
