"use client";

import * as React from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { utcToZonedTime } from "date-fns-tz";
import { CalendarDays } from "lucide-react";
import { appointmentToCyprusDate, CY_TZ } from "@/lib/appointments";
import { ScheduleView } from "@/components/dashboard/ScheduleView";
import type { ScheduleAppointment } from "@/components/dashboard/ScheduleView";
import { UpcomingList } from "@/components/dashboard/UpcomingList";

type AgendaAppointmentRow = {
  id: string;
  doctor_id: string;
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

export function AgendaRealtime({
  doctorId,
  initialAppointments,
}: {
  doctorId: string | null;
  initialAppointments: AgendaAppointmentRow[];
}) {
  const supabase = React.useMemo(() => createClientComponentClient(), []);
  const [appointments, setAppointments] =
    React.useState<AgendaAppointmentRow[]>(initialAppointments);
  const [toast, setToast] = React.useState(false);

  React.useEffect(() => {
    setAppointments(initialAppointments);
  }, [initialAppointments]);

  React.useEffect(() => {
    if (!doctorId) return;

    const channel = supabase
      .channel(`agenda-appointments-${doctorId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
          filter: `doctor_id=eq.${doctorId}`,
        },
        (payload) => {
          const next = payload.new as AgendaAppointmentRow | null;
          if (!next?.id) return;

          setAppointments((prev) => {
            if (prev.some((p) => p.id === next.id)) return prev;
            const merged = [next, ...prev];
            merged.sort(
              (a, b) =>
                new Date(a.appointment_datetime).getTime() -
                new Date(b.appointment_datetime).getTime()
            );
            return merged;
          });

          setToast(true);
          window.setTimeout(() => setToast(false), 3000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [doctorId, supabase]);

  const nowUtc = new Date();
  const nowCyprus = utcToZonedTime(nowUtc, CY_TZ);
  const todayKey = format(nowCyprus, "yyyy-MM-dd");

  const rows = appointments.map((a) => {
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
    };
  });

  const todayRows = rows.filter((r) => r.dateKey === todayKey);
  const scheduleAppointments: ScheduleAppointment[] = todayRows.map((r) => ({
    id: r.id,
    patient_name: r.patient_name,
    patient_phone: r.patient_phone,
    patient_email: r.patient_email,
    whatsappUrl: r.whatsappUrl,
    timeLabel: r.timeLabel,
    minutesFrom8: r.minutesFrom8,
  }));

  return (
    <>
      {toast && (
        <div className="fixed right-5 top-5 z-50 rounded-2xl border border-emerald-400/30 bg-slate-900/90 px-4 py-3 text-xs font-medium text-emerald-200 shadow-2xl shadow-slate-950/60 backdrop-blur">
          New appointment booked!
        </div>
      )}

      <section className="rounded-3xl border border-emerald-100/10 bg-slate-900/50 shadow-2xl shadow-slate-950/50 backdrop-blur-xl">
        <div className="border-b border-slate-800/60 px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-200">
              {format(nowCyprus, "EEEE, d MMMM yyyy", { locale: enGB })}
            </h2>
            <span
              aria-label={`${scheduleAppointments.length} appointment${
                scheduleAppointments.length === 1 ? "" : "s"
              } today`}
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
          <ScheduleView
            appointments={scheduleAppointments}
          />
        </div>
      </section>

      {rows.length > 0 && rows.length > todayRows.length && (
        <section className="rounded-3xl border border-slate-800/80 bg-slate-900/30 px-4 pb-5 pt-5 sm:px-5 sm:pb-6 sm:pt-6">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            Upcoming on other days
          </h3>
          <UpcomingList
            items={rows
              .filter((r) => r.dateKey !== todayKey)
              .slice(0, 5)
              .map((r) => ({
                id: r.id,
                patient_name: r.patient_name,
                dateLabel: r.dateLabel,
                timeLabel: r.timeLabel,
              }))}
          />
        </section>
      )}
    </>
  );
}

