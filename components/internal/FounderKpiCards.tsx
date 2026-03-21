import { Users, CalendarDays, Activity, UserPlus } from "lucide-react";

type Props = {
  totalDoctors: number;
  totalAppointments: number;
  activeDoctors7d: number;
  newDoctorsThisWeek: number;
};

const cardBase =
  "group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 shadow-xl shadow-black/20 backdrop-blur-sm transition hover:border-slate-700/90 hover:bg-slate-900/60";

export function FounderKpiCards({
  totalDoctors,
  totalAppointments,
  activeDoctors7d,
  newDoctorsThisWeek,
}: Props) {
  const items = [
    {
      label: "Total doctors",
      value: totalDoctors,
      sub: "Registered profiles",
      icon: Users,
      accent: "from-emerald-500/20 to-teal-500/5",
      iconBg: "bg-emerald-500/15 text-emerald-300",
    },
    {
      label: "Total appointments",
      value: totalAppointments,
      sub: "All-time bookings",
      icon: CalendarDays,
      accent: "from-sky-500/20 to-blue-500/5",
      iconBg: "bg-sky-500/15 text-sky-300",
    },
    {
      label: "Active doctors (7d)",
      value: activeDoctors7d,
      sub: "Received a booking",
      icon: Activity,
      accent: "from-violet-500/20 to-fuchsia-500/5",
      iconBg: "bg-violet-500/15 text-violet-300",
    },
    {
      label: "New doctors (week)",
      value: newDoctorsThisWeek,
      sub: "Since Mon (local)",
      icon: UserPlus,
      accent: "from-amber-500/20 to-orange-500/5",
      iconBg: "bg-amber-500/15 text-amber-300",
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ label, value, sub, icon: Icon, accent, iconBg }) => (
        <div key={label} className={cardBase}>
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-80`}
            aria-hidden
          />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {label}
              </p>
              <p className="mt-2 tabular-nums text-3xl font-semibold tracking-tight text-white">
                {value}
              </p>
              <p className="mt-1 text-xs text-slate-500">{sub}</p>
            </div>
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg} ring-1 ring-white/10`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
