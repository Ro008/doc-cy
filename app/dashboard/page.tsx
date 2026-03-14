// app/dashboard/page.tsx
import Link from "next/link";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { appointmentToCyprusDate, CY_TZ } from "@/lib/appointments";
import { utcToZonedTime } from "date-fns-tz";
import { ScheduleView } from "@/components/dashboard/ScheduleView";
import type { ScheduleAppointment } from "@/components/dashboard/ScheduleView";

export const revalidate = 0;

type AppointmentRow = {
  id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string;
  appointment_datetime: string;
};

function getWhatsAppUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies });

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select(
      "id, patient_name, patient_phone, patient_email, appointment_datetime"
    )
    .order("appointment_datetime", { ascending: true });

  if (error) {
    console.error(error);
  }

  const nowUtc = new Date();
  const nowCyprus = utcToZonedTime(nowUtc, CY_TZ);
  const todayKey = format(nowCyprus, "yyyy-MM-dd");
  const nowLabel = format(nowCyprus, "EEE d MMM yyyy, HH:mm", {
    locale: enGB,
  });

  const rows =
    (appointments as AppointmentRow[] | null)?.map((a) => {
      const cyDate = appointmentToCyprusDate(a.appointment_datetime);
      const dateKey = format(cyDate, "yyyy-MM-dd");
      const hours = cyDate.getHours();
      const minutes = cyDate.getMinutes();
      const minutesFrom8 = (hours - 8) * 60 + minutes;
      return {
        ...a,
        cyDate,
        dateKey,
        dateLabel: format(cyDate, "EEE d MMM yyyy", { locale: enGB }),
        timeLabel: format(cyDate, "HH:mm", { locale: enGB }),
        whatsappUrl: getWhatsAppUrl(a.patient_phone),
        minutesFrom8: Math.max(0, minutesFrom8),
        durationMinutes: 30,
      };
    }) ?? [];

  const todayRows = rows.filter((r) => r.dateKey === todayKey);
  const scheduleAppointments: ScheduleAppointment[] = todayRows.map((r) => ({
    id: r.id,
    patient_name: r.patient_name,
    patient_phone: r.patient_phone,
    patient_email: r.patient_email,
    whatsappUrl: r.whatsappUrl,
    timeLabel: r.timeLabel,
    minutesFrom8: r.minutesFrom8,
    durationMinutes: r.durationMinutes,
  }));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
              Doctor&apos;s Agenda
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Today&apos;s schedule · Europe/Nicosia time
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/settings"
              className="rounded-2xl border border-slate-700/80 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-200 backdrop-blur transition hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200"
            >
              Working hours & settings
            </Link>
            <p className="text-xs text-slate-400">
              Cyprus:{" "}
              <span className="font-mono text-slate-100">{nowLabel}</span>
            </p>
          </div>
        </header>

        <section className="rounded-3xl border border-emerald-100/10 bg-slate-900/50 shadow-2xl shadow-slate-950/50 backdrop-blur-xl">
          <div className="border-b border-slate-800/60 px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-200">
                {format(nowCyprus, "EEEE, d MMMM yyyy", { locale: enGB })}
              </h2>
              <span
                aria-label={`${scheduleAppointments.length} appointment${scheduleAppointments.length === 1 ? "" : "s"} today`}
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${
                  scheduleAppointments.length === 0
                    ? "bg-slate-700/60 text-slate-400"
                    : "bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/30"
                }`}
              >
                {scheduleAppointments.length}
              </span>
            </div>
            {scheduleAppointments.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">No appointments today</p>
            )}
          </div>
          <div className="px-4 pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-3">
            <ScheduleView appointments={scheduleAppointments} />
          </div>
        </section>

        {rows.length > 0 && rows.length > todayRows.length && (
          <section className="rounded-3xl border border-slate-800/80 bg-slate-900/30 px-4 pb-5 pt-5 sm:px-5 sm:pb-6 sm:pt-6">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              Upcoming on other days
            </h3>
            <ul className="mt-4 overflow-hidden rounded-xl border border-slate-800/60">
              {rows
                .filter((r) => r.dateKey !== todayKey)
                .slice(0, 5)
                .map((r, i) => (
                  <li
                    key={r.id}
                    className={`flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-slate-800/40 ${
                      i % 2 === 0
                        ? "bg-slate-900/50"
                        : "bg-slate-800/30"
                    }`}
                  >
                    <span className="font-medium text-slate-100">
                      {r.patient_name}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-slate-400">
                      {r.dateLabel} · {r.timeLabel}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

