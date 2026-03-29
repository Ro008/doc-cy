import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { addMinutes } from "date-fns";
import { CheckCircle2, CalendarPlus, Clock } from "lucide-react";

import { createServiceRoleClient } from "@/lib/supabase-service";
import { appointmentToCyprusDate } from "@/lib/appointments";
import {
  buildGoogleCalendarUrl,
  getCalendarEventDetails,
} from "@/lib/patient-calendar-event";
import { getTranslations } from "next-intl/server";
import { isConfirmedForCalendar } from "@/lib/appointment-status";

type PageProps = {
  params: { slug: string };
  searchParams?: { appointmentId?: string };
};

export const revalidate = 0;

export default async function BookingSuccessPage({
  params,
  searchParams,
}: PageProps) {
  const t = await getTranslations("BookingPage");
  const appointmentId = (searchParams?.appointmentId ?? "").trim();
  if (!appointmentId) {
    redirect(`/${params.slug}`);
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    redirect(`/${params.slug}`);
  }

  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .select(
      "id, doctor_id, patient_name, appointment_datetime, status, visit_type, visit_notes, reason",
    )
    .eq("id", appointmentId)
    .single();

  if (apptError || !appointment) {
    redirect(`/${params.slug}`);
  }

  const [doctorResult, settingsResult] = await Promise.all([
    supabase
      .from("doctors")
      .select("id, name, slug, phone, clinic_address, specialty")
      .eq("id", appointment.doctor_id)
      .single(),
    supabase
      .from("doctor_settings")
      .select("slot_duration_minutes")
      .eq("doctor_id", appointment.doctor_id)
      .single(),
  ]);

  if (doctorResult.error || !doctorResult.data) {
    redirect(`/${params.slug}`);
  }

  const doctor = doctorResult.data;

  if (doctor.slug !== params.slug) {
    redirect(
      `/${doctor.slug}/request-sent?appointmentId=${encodeURIComponent(appointmentId)}`,
    );
  }

  const durationMinutes =
    (settingsResult.data as { slot_duration_minutes?: number | null } | null)
      ?.slot_duration_minutes ?? 30;

  const startUtc = new Date(appointment.appointment_datetime as string);
  const endUtc = addMinutes(startUtc, durationMinutes);

  const startCy = appointmentToCyprusDate(appointment.appointment_datetime as string);
  const dateLabel = format(startCy, "dd/MM/yyyy");
  const timeLabel = format(startCy, "HH:mm");

  const apptRow = appointment as {
    visit_type?: string | null;
    visit_notes?: string | null;
    reason?: string | null;
  };

  const confirmed = isConfirmedForCalendar(appointment.status as string);

  const cal = getCalendarEventDetails(
    {
      id: appointment.id as string,
      appointment_datetime: appointment.appointment_datetime as string,
    },
    {
      name: doctor.name,
      specialty: (doctor as { specialty?: string | null }).specialty,
      phone: doctor.phone,
      clinic_address: (doctor as { clinic_address?: string | null }).clinic_address,
    },
    {
      reason: apptRow.reason,
      visitType: apptRow.visit_type,
      visitNotes: apptRow.visit_notes,
    },
    { includeWhatsAppContact: confirmed }
  );

  const googleUrl = confirmed
    ? buildGoogleCalendarUrl({
        title: cal.title,
        description: cal.description,
        location: cal.location,
        startUtc,
        endUtc,
      })
    : "";

  const accent = confirmed ? "emerald" : "amber";
  const accentBorder =
    accent === "emerald" ? "border-emerald-200/20" : "border-amber-200/20";
  const accentShadow =
    accent === "emerald"
      ? "shadow-emerald-500/10"
      : "shadow-amber-500/10";
  const blurTop =
    accent === "emerald" ? "bg-emerald-500/10" : "bg-amber-500/10";
  const blurSide =
    accent === "emerald" ? "bg-emerald-400/10" : "bg-amber-400/10";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className={`absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full ${blurTop} blur-3xl`}
        />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
        <div
          className={`absolute inset-y-0 right-[-15%] h-full w-72 ${blurSide} blur-3xl`}
        />
      </div>

      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section
          data-testid="booking-request-sent-page"
          data-appointment-id={appointmentId}
          className={`rounded-3xl border ${accentBorder} bg-slate-900/60 p-8 shadow-2xl ${accentShadow} backdrop-blur-xl sm:p-10`}
        >
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div
                className={
                  confirmed
                    ? "absolute inset-0 scale-150 rounded-full bg-emerald-400/20 blur-2xl"
                    : "absolute inset-0 scale-150 rounded-full bg-amber-400/20 blur-2xl"
                }
              />
              {confirmed ? (
                <CheckCircle2
                  className="relative h-20 w-20 text-emerald-400 sm:h-24 sm:w-24"
                  strokeWidth={1.5}
                  aria-hidden
                />
              ) : (
                <Clock
                  className="relative h-20 w-20 text-amber-400 sm:h-24 sm:w-24"
                  strokeWidth={1.5}
                  aria-hidden
                />
              )}
            </div>

            <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
              {confirmed
                ? t("appointmentConfirmedTitle")
                : t("requestPendingTitle")}
            </h1>

            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
              {confirmed
                ? t("appointmentConfirmedMessage", { doctorName: doctor.name })
                : t("requestPendingMessage", { doctorName: doctor.name })}
            </p>

            <div className="mt-6 w-full max-w-md rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-4 text-left">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t("appointmentProfessionalLabel")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-100">
                    {doctor.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t("appointmentDateLabel")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-100">
                    {dateLabel}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t("appointmentTimeLabel")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-100">
                    {timeLabel}{" "}
                    <span className="text-slate-400">
                      {t("cyprusTimeInParentheses")}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t("appointmentStatusLabel")}
                  </p>
                  <p
                    className={
                      confirmed
                        ? "mt-1 text-sm font-medium text-emerald-200"
                        : "mt-1 text-sm font-medium text-amber-200"
                    }
                  >
                    {confirmed
                      ? t("appointmentStatusConfirmed")
                      : t("appointmentStatusRequested")}
                  </p>
                </div>
              </div>
            </div>

            {confirmed ? (
              <div className="mt-8 grid w-full max-w-md gap-3 sm:grid-cols-2">
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  <CalendarPlus className="h-4 w-4" aria-hidden />
                  {t("addToGoogleLabel")}
                </a>

                <a
                  href={`/api/appointments/${encodeURIComponent(appointmentId)}/calendar`}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 shadow-lg shadow-emerald-500/10 transition hover:border-emerald-400/60 hover:bg-emerald-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {t("downloadIcsLabel")}
                </a>
              </div>
            ) : (
              <p className="mt-8 max-w-md text-center text-sm text-slate-400">
                {t("requestPendingCalendarHint")}
              </p>
            )}

            <div className="mt-8 w-full max-w-md">
              <Link
                href={`/${params.slug}`}
                className="flex w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                {t("backToProfileLabel")}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
