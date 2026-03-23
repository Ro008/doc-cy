// app/agenda/settings/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { SignOutButton } from "@/components/auth/SignOutButton";
import type { DoctorSettingsFormData } from "@/components/dashboard/SettingsForm";
import { ArrowLeft } from "lucide-react";
import { ViewPublicProfileLink } from "@/components/agenda/ViewPublicProfileLink";
import { PromotePracticeSection } from "@/components/dashboard/PromotePracticeSection";
import {
  canonicalLanguageLabel,
  isMasterLanguageLabel,
} from "@/lib/cyprus-languages";

function timeFromRow(t: string | null | undefined): string {
  if (!t) return "09:00";
  const parts = String(t).split(":");
  const h = parts[0]?.padStart(2, "0") ?? "09";
  const m = parts[1]?.padStart(2, "0") ?? "00";
  return `${h}:${m}`;
}

export default async function AgendaSettingsPage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Fetch doctor row for this authenticated user.
  // If the `phone` column isn't available in the DB yet (or query fails),
  // fall back to a basic select so the rest of the settings page still works.
  let doctor: {
    id: string;
    name: string;
    phone?: string | null;
    slug?: string | null;
    specialty?: string | null;
    languages?: string[] | null;
    status?: string | null;
    is_specialty_approved?: boolean | null;
  } | null = null;
  let doctorError: unknown = null;
  try {
    const res = await supabase
      .from("doctors")
      .select("id, name, phone, slug, specialty, languages, status")
      .eq("auth_user_id", user.id)
      .single();
    doctor = res.data as typeof doctor;
    doctorError = res.error;
  } catch (err) {
    doctorError = err;
  }

  if (!doctor) {
    const fallback = await supabase
      .from("doctors")
      .select("id, name, slug, specialty, languages, status, is_specialty_approved")
      .eq("auth_user_id", user.id)
      .single();
    doctor = fallback.data as typeof doctor;
    doctorError = fallback.error ?? doctorError;
  }

  if (doctorError) {
    console.error("[Settings] Error fetching doctor for user", doctorError);
  }

  if (!doctor) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
          <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-emerald-400/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-2xl px-4 py-12 text-center">
          <p className="text-slate-200">
            Professional profile not found for this account. Please contact support.
          </p>
          <SignOutButton />
          <Link
            href="/agenda"
            className="mt-4 inline-flex items-center text-sm text-emerald-300 hover:text-emerald-200"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to agenda
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

  const langArr = Array.from(
    new Set(
      (Array.isArray(doctor.languages) ? doctor.languages : [])
        .map((s) => canonicalLanguageLabel(String(s).trim()))
        .filter((l) => l.length > 0 && isMasterLanguageLabel(l))
    )
  );

  const isVerified = doctor.status === "verified";

  const initial: DoctorSettingsFormData = {
    doctorId: doctor.id,
    doctorName: doctor.name,
    specialty: (doctor.specialty ?? "").trim(),
    isSpecialtyApproved: doctor.is_specialty_approved ?? true,
    languages: langArr,
    whatsappNumber: doctor.phone ?? undefined,
    monday: (settings as { monday?: boolean } | null)?.monday ?? true,
    tuesday: (settings as { tuesday?: boolean } | null)?.tuesday ?? true,
    wednesday: (settings as { wednesday?: boolean } | null)?.wednesday ?? true,
    thursday: (settings as { thursday?: boolean } | null)?.thursday ?? true,
    friday: (settings as { friday?: boolean } | null)?.friday ?? true,
    startTime: timeFromRow((settings as { start_time?: string } | null)?.start_time),
    endTime: timeFromRow((settings as { end_time?: string } | null)?.end_time),
    breakEnabled:
      Boolean((settings as { break_start?: string | null } | null)?.break_start) &&
      Boolean((settings as { break_end?: string | null } | null)?.break_end),
    breakStart: timeFromRow(
      (settings as { break_start?: string | null } | null)?.break_start
    ),
    breakEnd: timeFromRow(
      (settings as { break_end?: string | null } | null)?.break_end
    ),
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
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/agenda"
              className="mb-4 inline-flex items-center text-sm text-slate-400 transition hover:text-slate-200"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to agenda
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
              Working hours & availability
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              These settings apply to{" "}
              <span className="font-medium text-emerald-200">
                {doctor.name}
              </span>
              .
            </p>
            {doctor.is_specialty_approved === false ? (
              <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                Your specialty text is pending review. You can edit it below or pick a standard
                category — we&apos;ll align it with our directory list.
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <ViewPublicProfileLink slug={doctor.slug} isVerified={isVerified} />
            <SignOutButton />
          </div>
        </header>

        <section className="rounded-3xl border border-emerald-100/10 bg-slate-900/50 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur-xl sm:p-8">
          <SettingsForm initial={initial} />
        </section>

        <div className="mt-8">
          {isVerified ? (
            <>
              <p className="mb-3 text-xs text-slate-500">
                <span className="font-medium text-slate-400">Quick access:</span> use the floating{" "}
                <span className="text-emerald-300/90">QR</span> button (bottom-right, above Feedback)
                on any agenda page for the same poster and download.
              </p>
              <PromotePracticeSection slug={doctor.slug} doctorName={doctor.name} />
            </>
          ) : (
            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5">
              <h2 className="text-sm font-semibold text-slate-100">Promote your practice</h2>
              <p className="mt-2 text-sm text-slate-400">
                QR codes, printable signs, and downloads are available after your profile is{" "}
                <span className="font-medium text-amber-200/90">verified</span> by our team. You can
                still use your agenda and settings in the meantime.
              </p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
