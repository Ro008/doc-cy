export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";
import { DoctorDashboard } from "@/components/dashboard/DoctorDashboard";
import { CY_TZ } from "@/lib/appointments";
import { locationToAgendaHours, locationsToAgendaClinics } from "@/lib/agenda-clinics";
import { firstNameFromProfessionalName } from "@/lib/doctor-display-name";
import {
  DASHBOARD_APPOINTMENT_SELECT,
  todayWorkingWindow,
  type DashboardAppointmentRow,
} from "@/lib/doctor-dashboard";
import {
  DOCTOR_FIRST_LOGIN_PATH,
  shouldRedirectFirstLoginToSettings,
} from "@/lib/first-login-trial-notice";
import { loadDoctorLocations, primaryDoctorLocation } from "@/lib/load-doctor-locations";
import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";

/** Proposals that lapsed longer ago than this are not listed (lib/reschedule-follow-up.ts). */
const LAPSED_PROPOSAL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Today onwards, plus proposals waiting on the patient or lapsed without a choice (stored as
 * EXPIRED with proposal_expires_at; their original time can be in the past).
 */
async function loadDashboardAppointments(
  supabase: ReturnType<typeof createServerComponentClient>,
  doctorId: string,
  todayStartUtc: string,
  nowMs: number,
) {
  const lapsedSince = new Date(nowMs - LAPSED_PROPOSAL_WINDOW_MS).toISOString();
  return fetchAllSupabaseRows(() =>
    supabase
      .from("appointments")
      .select(DASHBOARD_APPOINTMENT_SELECT)
      .eq("professional_id", doctorId)
      .or(
        `appointment_datetime.gte."${todayStartUtc}",status.eq.NEEDS_RESCHEDULE,and(status.eq.EXPIRED,proposal_expires_at.gte."${lapsedSince}")`,
      )
      .order("appointment_datetime", { ascending: true }),
  );
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
    .select("id, name, slug, trial_notice_seen_at")
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
      .select("id, name, slug")
      .eq("auth_user_id", user.id)
      .single();
  }

  const doctor = doctorRes.data as {
    id: string;
    name: string | null;
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

  const [{ data: appointments, error: appointmentsError }, locationRows] = await Promise.all([
    loadDashboardAppointments(supabase, doctor.id, todayStartUtc, nowMs),
    loadDoctorLocations(doctor.id),
  ]);

  if (appointmentsError) {
    console.error("[Dashboard] Error fetching appointments", appointmentsError);
  }

  const clinics = locationsToAgendaClinics(locationRows);
  const hoursList = clinics.map((clinic) => clinic.hours);
  // The primary clinic's hours frame the timeline (schedules live on the clinic links).
  const primaryClinic = primaryDoctorLocation(locationRows);
  const workingHours = primaryClinic ? locationToAgendaHours(primaryClinic) : null;

  // Pausing is per clinic.
  const pausedClinicNames = clinics
    .filter((_, i) => locationRows[i]?.pause_online_bookings)
    .map((clinic) => clinic.name);
  const bookingsPaused = {
    all: clinics.length > 0 && pausedClinicNames.length === clinics.length,
    clinicNames: pausedClinicNames,
  };

  return (
    <main className="min-h-screen bg-ink-900 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-clinical-500/[0.04] via-transparent to-transparent" />
      <DoctorDashboard
        doctorId={doctor.id}
        doctorSlug={doctor.slug}
        firstName={firstNameFromProfessionalName(doctor.name)}
        appointments={(appointments ?? []) as DashboardAppointmentRow[]}
        workingHours={workingHours}
        clinics={clinics}
        todayWindow={todayWorkingWindow(hoursList, nowMs)}
        bookingsPaused={bookingsPaused}
      />
    </main>
  );
}
