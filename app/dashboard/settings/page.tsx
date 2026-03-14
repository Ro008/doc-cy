// app/dashboard/settings/page.tsx
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import type { DoctorSettingsFormData } from "@/components/dashboard/SettingsForm";
import { ArrowLeft } from "lucide-react";

export const revalidate = 0;

function timeFromRow(t: string | null | undefined): string {
  if (!t) return "09:00";
  const parts = String(t).split(":");
  const h = parts[0]?.padStart(2, "0") ?? "09";
  const m = parts[1]?.padStart(2, "0") ?? "00";
  return `${h}:${m}`;
}

export default async function DashboardSettingsPage() {
  // MVP: use first doctor. Later: get from auth/session.
  const { data: doctors } = await supabase
    .from("doctors")
    .select("id, name")
    .limit(1);

  const doctor = doctors?.[0];
  if (!doctor) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
          <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-emerald-400/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-2xl px-4 py-12 text-center">
          <p className="text-slate-300">No doctor found. Add a doctor first.</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center text-sm text-emerald-300 hover:text-emerald-200"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const { data: settings } = await supabase
    .from("doctor_settings")
    .select("*")
    .eq("doctor_id", doctor.id)
    .single();

  const initial: DoctorSettingsFormData = {
    doctorId: doctor.id,
    doctorName: doctor.name,
    monday: (settings as { monday?: boolean } | null)?.monday ?? true,
    tuesday: (settings as { tuesday?: boolean } | null)?.tuesday ?? true,
    wednesday: (settings as { wednesday?: boolean } | null)?.wednesday ?? true,
    thursday: (settings as { thursday?: boolean } | null)?.thursday ?? true,
    friday: (settings as { friday?: boolean } | null)?.friday ?? true,
    startTime: timeFromRow((settings as { start_time?: string } | null)?.start_time),
    endTime: timeFromRow((settings as { end_time?: string } | null)?.end_time),
    slotDurationMinutes:
      (settings as { slot_duration_minutes?: number } | null)
        ?.slot_duration_minutes ?? 30,
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="mb-8">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center text-sm text-slate-400 transition hover:text-slate-200"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to agenda
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Working hours & availability
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Configure when patients can book with you. These settings apply to{" "}
            <span className="font-medium text-emerald-200">{doctor.name}</span>.
          </p>
        </header>

        <section className="rounded-3xl border border-emerald-100/10 bg-slate-900/50 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur-xl sm:p-8">
          <SettingsForm initial={initial} />
        </section>
      </div>
    </main>
  );
}
