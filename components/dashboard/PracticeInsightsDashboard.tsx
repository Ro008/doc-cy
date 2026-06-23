"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock, Moon, Users, CalendarCheck, Sparkles, UserX } from "lucide-react";
import type { PracticeInsightsSnapshot, WeekdayBucketKey } from "@/lib/practice-insights";
import { useTranslations } from "next-intl";

type Props = {
  insights: PracticeInsightsSnapshot;
};

function ComingSoonPanel({
  title,
  note,
}: {
  title: string;
  note: string;
}) {
  return (
    <div className="flex h-full min-h-[220px] flex-col rounded-2xl border border-dashed border-slate-600/80 bg-ink-900/40 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-slate-500" aria-hidden />
        <p className="text-sm font-semibold text-slate-200">{title}</p>
        <span className="ml-auto rounded-full border border-slate-600/80 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Coming soon
        </span>
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-500">{note}</p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-clinical-300/15 bg-slate-900/70 p-4 shadow-[0_0_32px_-18px_rgba(16,185,129,0.35)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-clinical-500/10 text-clinical-300">
          {icon}
        </div>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
    </article>
  );
}

export function PracticeInsightsDashboard({ insights }: Props) {
  const t = useTranslations("PracticeInsights");
  const gradId = React.useId().replace(/:/g, "");

  const weekdayLabel = (day: WeekdayBucketKey) =>
    t(`charts.weekdays.${day}` as "charts.weekdays.monday");

  const weekdayChartData = insights.peakByWeekday.map((row) => ({
    name: weekdayLabel(row.day),
    bookings: row.count,
  }));

  const hourChartData =
    insights.peakByHour.length > 0
      ? insights.peakByHour.map((row) => ({
          name: row.label,
          bookings: row.count,
        }))
      : [{ name: "—", bookings: 0 }];

  const hoursSavedDisplay =
    insights.phoneTimeSavedHours >= 1
      ? t("hero.hoursValue", { hours: insights.phoneTimeSavedHours })
      : t("hero.minutesValue", {
          minutes: insights.confirmedThisMonth * 4,
        });

  const noShowsValue =
    insights.noShowRatePercent != null
      ? `${insights.noShowsThisMonth} (${insights.noShowRatePercent}%)`
      : insights.noShowsThisMonth;

  const noShowsHint =
    insights.noShowRatePercent != null
      ? t("kpis.noShows.hintWithRate", {
          count: insights.noShowsThisMonth,
          total: insights.endedConfirmedVisitsThisMonth,
          rate: insights.noShowRatePercent,
        })
      : insights.noShowsThisMonth > 0
        ? t("kpis.noShows.hint", { month: insights.monthLabel })
        : t("kpis.noShows.hintEmpty", { month: insights.monthLabel });

  return (
    <div className="space-y-8">
      <section
        className="rounded-3xl border border-clinical-300/25 bg-gradient-to-br from-clinical-500/10 via-slate-900/80 to-slate-950/90 p-6 sm:p-8"
        aria-labelledby="practice-insights-hero"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clinical-300/90">
          {t("hero.eyebrow")}
        </p>
        <h2
          id="practice-insights-hero"
          className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl"
        >
          {hoursSavedDisplay}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
          {t("hero.body", { month: insights.monthLabel })}
        </p>
        <p className="mt-2 text-xs text-slate-500">{t("hero.footnote")}</p>
      </section>

      <section aria-labelledby="practice-insights-kpis">
        <h2 id="practice-insights-kpis" className="sr-only">
          {t("kpis.heading")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label={t("kpis.totalBookings.label")}
            value={insights.totalBookingsThisMonth}
            hint={t("kpis.totalBookings.hint", { month: insights.monthLabel })}
            icon={<CalendarCheck className="h-4 w-4" aria-hidden />}
          />
          <KpiCard
            label={t("kpis.weekendShield.label")}
            value={insights.weekendShieldCount}
            hint={t("kpis.weekendShield.hint")}
            icon={<Moon className="h-4 w-4" aria-hidden />}
          />
          <KpiCard
            label={t("kpis.newPatients.label")}
            value={insights.newPatientsCapturedThisMonth}
            hint={t("kpis.newPatients.hint", { month: insights.monthLabel })}
            icon={<Users className="h-4 w-4" aria-hidden />}
          />
          <KpiCard
            label={t("kpis.noShows.label")}
            value={noShowsValue}
            hint={noShowsHint}
            icon={<UserX className="h-4 w-4" aria-hidden />}
          />
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="practice-insights-charts">
        <h2
          id="practice-insights-charts"
          className="text-lg font-semibold tracking-tight text-slate-100"
        >
          {t("charts.heading")}
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/35 p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-800/60 pb-4">
              <Clock className="h-4 w-4 text-clinical-300" aria-hidden />
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {t("charts.peakTimes.title")}
                </h3>
                <p className="text-xs text-slate-500">{t("charts.peakTimes.subtitle")}</p>
              </div>
            </div>
            <div className="h-56 w-full min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekdayChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={{ stroke: "rgba(148,163,184,0.2)" }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15,23,42,0.95)",
                      border: "1px solid rgba(148,163,184,0.25)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "#e2e8f0",
                    }}
                    formatter={(value: number) => [value, t("charts.tooltipBookings")]}
                  />
                  <Bar
                    dataKey="bookings"
                    fill={`url(#insightsBar-${gradId})`}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                  />
                  <defs>
                    <linearGradient id={`insightsBar-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0B7BB5" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity={0.75} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {insights.peakByHour.length > 0 ? (
              <div className="mt-6 border-t border-slate-800/60 pt-4">
                <p className="mb-3 text-xs font-medium text-slate-400">
                  {t("charts.peakHours.subtitle")}
                </p>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#64748b", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis hide allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(15,23,42,0.95)",
                          border: "1px solid rgba(148,163,184,0.25)",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                        formatter={(value: number) => [value, t("charts.tooltipBookings")]}
                      />
                      <Bar dataKey="bookings" fill="#0B7BB5" radius={[4, 4, 0, 0]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
          </div>

          <ComingSoonPanel
            title={t("charts.visitReasons.title")}
            note={t("charts.visitReasons.comingSoonNote")}
          />
        </div>
      </section>
    </div>
  );
}
