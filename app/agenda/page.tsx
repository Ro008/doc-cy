export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { appointmentToCyprusDate, CY_TZ } from "@/lib/appointments";
import { utcToZonedTime } from "date-fns-tz";
import { AgendaRealtime } from "@/components/agenda/AgendaRealtime";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function AgendaPage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("Logged in user ID:", user?.id ?? null);

  let doctor = null as
    | { id: string; name: string; status: string | null; auth_user_id: string }
    | null;

  if (user?.id) {
    const { data, error } = await supabase
      .from("doctors")
      .select("id, name, status, auth_user_id")
      .eq("auth_user_id", user.id)
      .single();

    if (error) {
      console.error("[Agenda] Error fetching doctor for user", error);
    }

    doctor = data;
  }

  console.log("Fetched doctor:", doctor);

  const appointmentsQuery = supabase
    .from("appointments")
    .select(
      "id, doctor_id, patient_name, patient_phone, patient_email, appointment_datetime"
    )
    .order("appointment_datetime", { ascending: true });

  const { data: appointments, error } = doctor?.id
    ? await appointmentsQuery.eq("doctor_id", doctor.id)
    : await appointmentsQuery;

  if (error) {
    console.error(error);
  }

  const nowUtc = new Date();
  const nowCyprus = utcToZonedTime(nowUtc, CY_TZ);
  const nowLabel = format(nowCyprus, "EEE d MMM yyyy, HH:mm", {
    locale: enGB,
  });

  const rawName = (doctor?.name ?? "").trim();
  const nameWithoutDr = rawName.replace(/^dr\.?\s+/i, "").trim();
  const demoName = nameWithoutDr || "Doctor";
  const doctorName = `Dr. ${demoName}`;

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
              Your agenda, {doctorName}
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Today&apos;s schedule · Europe/Nicosia time
            </p>
            {doctor && doctor.status !== "active" && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-100">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-300" />
                Your public profile is under review. We&apos;ll notify you when
                it&apos;s active.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/agenda/settings"
              className="rounded-2xl border border-slate-700/80 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-200 backdrop-blur transition hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200"
            >
              Working hours & settings
            </Link>
            <SignOutButton />
            <p className="text-xs text-slate-400">
              Cyprus:{" "}
              <span className="font-mono text-slate-100">{nowLabel}</span>
            </p>
          </div>
        </header>

        <AgendaRealtime
          doctorId={doctor?.id ?? null}
          initialAppointments={(appointments as any[]) ?? []}
        />
      </div>
    </main>
  );
}

