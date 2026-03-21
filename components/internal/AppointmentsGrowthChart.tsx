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
import type { MonthBucket } from "@/lib/founder-appointments-by-month";
import { BarChart3 } from "lucide-react";

type Props = { data: MonthBucket[] };

export function AppointmentsGrowthChart({ data }: Props) {
  const gradId = React.useId().replace(/:/g, "");

  const chartData = data.map((d) => ({
    name: d.label,
    appointments: d.count,
  }));

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/35 p-5 shadow-lg shadow-black/25 backdrop-blur-sm">
      <div className="mb-4 flex items-center gap-2 border-b border-slate-800/60 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
          <BarChart3 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Appointment volume</h2>
          <p className="text-xs text-slate-500">New bookings by month · last 6 months</p>
        </div>
      </div>
      <div className="h-56 w-full min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
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
              width={32}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15,23,42,0.95)",
                border: "1px solid rgba(148,163,184,0.25)",
                borderRadius: "12px",
                fontSize: "12px",
                color: "#e2e8f0",
              }}
              labelStyle={{ color: "#94a3b8" }}
              formatter={(value: number) => [`${value}`, "Appointments"]}
            />
            <Bar
              dataKey="appointments"
              fill={`url(#doccyBarGradient-${gradId})`}
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
            />
            <defs>
              <linearGradient id={`doccyBarGradient-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#0d9488" stopOpacity={0.75} />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
