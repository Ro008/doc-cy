import { formatDistanceToNow } from "date-fns";
import { enGB } from "date-fns/locale";
import { utcToZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import { Clock, Sparkles } from "lucide-react";
import { CY_TZ } from "@/lib/appointments";

export type RecentAppointmentRow = {
  id: string;
  patient_name: string;
  appointment_datetime: string;
  created_at?: string | null;
  doctor_id: string;
  doctor_name: string | null;
};

function formatApptWhen(iso: string) {
  try {
    const cy = utcToZonedTime(new Date(iso), CY_TZ);
    return format(cy, "EEE d MMM · HH:mm", { locale: enGB });
  } catch {
    return iso;
  }
}

type Props = { items: RecentAppointmentRow[] };

export function RecentActivityFeed({ items }: Props) {
  return (
    <aside className="rounded-2xl border border-slate-800/80 bg-slate-900/35 p-5 shadow-lg shadow-black/25 backdrop-blur-sm xl:sticky xl:top-6">
      <div className="flex items-center gap-2 border-b border-slate-800/60 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
          <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Recent activity</h2>
          <p className="text-xs text-slate-500">Latest 5 bookings</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No appointments yet.</p>
      ) : (
        <ol className="mt-4 space-y-4">
          {items.map((row, idx) => {
            const bookedRef = row.created_at
              ? new Date(row.created_at)
              : new Date(row.appointment_datetime);
            const relative = formatDistanceToNow(bookedRef, {
              addSuffix: true,
              locale: enGB,
            });
            return (
              <li
                key={row.id}
                className="relative rounded-xl border border-slate-800/60 bg-slate-950/40 p-3 pl-4"
              >
                <span
                  className="absolute left-0 top-3 h-8 w-0.5 rounded-full bg-gradient-to-b from-emerald-400 to-sky-500"
                  aria-hidden
                />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  #{idx + 1}
                </p>
                <p className="mt-0.5 font-medium text-slate-100">{row.patient_name}</p>
                <p className="mt-1 text-xs text-slate-400">
                  with{" "}
                  <span className="text-slate-300">
                    {row.doctor_name ?? "Unknown doctor"}
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Clock className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
                    {formatApptWhen(row.appointment_datetime)}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span>Booked {relative}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
