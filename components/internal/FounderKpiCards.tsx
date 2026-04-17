import { Users, CalendarDays, Activity, UserPlus, CalendarRange } from "lucide-react";
import { ResendUsageBar } from "@/components/internal/ResendUsageBar";
import type {
  ResendAccountQuota,
  ResendQuotaFailureReason,
} from "@/lib/resend-quota";

type Props = {
  totalDoctors: number;
  totalAppointments: number;
  appointmentsThisMonth: number;
  activeDoctors7d: number;
  newDoctorsThisWeek: number;
  resendLiveQuota: ResendAccountQuota | null;
  resendQuotaFailureReason: ResendQuotaFailureReason | null;
};

const cardBase =
  "group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 shadow-xl shadow-black/20 backdrop-blur-sm transition hover:border-slate-700/90 hover:bg-slate-900/60";

function KpiCard({
  label,
  value,
  sub,
  Icon,
  accent,
  iconBg,
}: {
  label: string;
  value: number;
  sub: string;
  Icon: typeof Users;
  accent: string;
  iconBg: string;
}) {
  return (
    <div className={cardBase}>
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
  );
}

export function FounderKpiCards({
  totalDoctors,
  totalAppointments,
  appointmentsThisMonth,
  activeDoctors7d,
  newDoctorsThisWeek,
  resendLiveQuota,
  resendQuotaFailureReason,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard
        label="Total professionals"
        value={totalDoctors}
        sub="Verified profiles"
        Icon={Users}
        accent="from-emerald-500/20 to-teal-500/5"
        iconBg="bg-emerald-500/15 text-emerald-300"
      />
      <KpiCard
        label="Total appointments"
        value={totalAppointments}
        sub="All-time bookings"
        Icon={CalendarDays}
        accent="from-sky-500/20 to-blue-500/5"
        iconBg="bg-sky-500/15 text-sky-300"
      />
      <div className="flex flex-col gap-3 sm:col-span-2 xl:col-span-1">
        <KpiCard
          label="Appointments (month)"
          value={appointmentsThisMonth}
          sub="Since 1st · Cyprus · created_at"
          Icon={CalendarRange}
          accent="from-cyan-500/20 to-sky-500/5"
          iconBg="bg-cyan-500/15 text-cyan-300"
        />
        <ResendUsageBar
          totalAppointments={totalAppointments}
          liveQuota={resendLiveQuota}
          quotaFailureReason={resendQuotaFailureReason}
        />
      </div>
      <KpiCard
        label="Active professionals (7d)"
        value={activeDoctors7d}
        sub="Received a booking"
        Icon={Activity}
        accent="from-violet-500/20 to-fuchsia-500/5"
        iconBg="bg-violet-500/15 text-violet-300"
      />
      <KpiCard
        label="New professionals (week)"
        value={newDoctorsThisWeek}
        sub="Since Mon (local)"
        Icon={UserPlus}
        accent="from-amber-500/20 to-orange-500/5"
        iconBg="bg-amber-500/15 text-amber-300"
      />
    </div>
  );
}
