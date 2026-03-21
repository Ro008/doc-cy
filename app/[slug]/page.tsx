// app/[slug]/page.tsx
import Image from "next/image";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { BookingSection } from "@/components/doctor/BookingSection";
import { DoctorDetailsAccordion } from "@/components/doctor/DoctorDetailsAccordion";
import { LanguagesSpoken } from "@/components/doctor/LanguagesSpoken";
import {
  ProfileNotLive,
  type PublicProfileBlockReason,
} from "@/components/doctor/ProfileNotLive";
import { WhatToExpectCard } from "@/components/doctor/WhatToExpectCard";
import {
  settingsToWeeklySlots,
  type DoctorSettingsRow,
} from "@/lib/doctor-settings";
import { appointmentToCyprusDate } from "@/lib/appointments";
import { format } from "date-fns";
import { CLINIC_ADDRESS, MAPS_URL } from "@/lib/clinic-info";

const DOCTOR_AVATAR_URL =
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop";

type DoctorProfileRow = {
  id: string;
  name: string;
  specialty: string;
  bio: string | null;
  clinic_address: string | null;
  slug: string;
  status: string;
  languages?: string[] | null;
};

type PageProps = {
  params: { slug: string };
};

const DOCTOR_SELECT_FULL =
  "id, name, specialty, bio, clinic_address, slug, status, languages";
const DOCTOR_SELECT_BASIC =
  "id, name, specialty, bio, clinic_address, slug, status";

function isLanguagesColumnError(msg: string): boolean {
  return (
    /languages/i.test(msg) &&
    (/schema cache|does not exist|column|Could not find|42703/i.test(msg) || msg.includes("Could not find"))
  );
}

type PublicDoctorFetch =
  | { kind: "ok"; profile: DoctorProfileRow }
  | { kind: "not_found" }
  | {
      kind: "not_verified";
      name: string;
      verificationStatus: PublicProfileBlockReason;
    };

/**
 * Load doctor by slug. Public UI only when verification `status` is `verified`.
 * If `languages` column is missing, fall back to a select without it.
 */
async function fetchPublicDoctorBySlug(slug: string): Promise<PublicDoctorFetch> {
  const first = await supabase
    .from("doctors")
    .select(DOCTOR_SELECT_FULL)
    .eq("slug", slug)
    .maybeSingle();

  let row: DoctorProfileRow | null = first.data as DoctorProfileRow | null;

  if (first.error) {
    const msg = first.error.message ?? "";
    if (isLanguagesColumnError(msg)) {
      const second = await supabase
        .from("doctors")
        .select(DOCTOR_SELECT_BASIC)
        .eq("slug", slug)
        .maybeSingle();
      if (second.error || !second.data) {
        console.error("[DocCy] Doctor profile fallback query failed:", second.error ?? "no row");
        return { kind: "not_found" };
      }
      row = { ...second.data, languages: null } as DoctorProfileRow;
    } else {
      console.error("[DocCy] Doctor profile query failed:", first.error);
      return { kind: "not_found" };
    }
  }

  if (!row) {
    return { kind: "not_found" };
  }

  const st = (row.status ?? "").trim().toLowerCase();
  if (st === "verified") {
    return { kind: "ok", profile: row };
  }

  const verificationStatus: PublicProfileBlockReason =
    st === "rejected" ? "rejected" : "pending";
  return { kind: "not_verified", name: row.name, verificationStatus };
}

export const revalidate = 0;

export async function generateMetadata(
  { params }: PageProps
): Promise<Metadata> {
  const { data: doctor } = await supabase
    .from("doctors")
    .select("name, specialty, status")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!doctor) {
    return { title: "Doctor not found | DocCy" };
  }

  const st = (doctor.status ?? "").trim().toLowerCase();
  if (st !== "verified") {
    return {
      title: `${doctor.name} | Profile not available | DocCy`,
      description: "This doctor profile is not public for booking yet.",
    };
  }

  return {
    title: `${doctor.name} – ${doctor.specialty} | DocCy`,
    description: `Book an appointment with ${doctor.name}, ${doctor.specialty} in Cyprus via DocCy.`,
  };
}

export default async function DoctorPage({ params }: PageProps) {
  const result = await fetchPublicDoctorBySlug(params.slug);

  if (result.kind === "not_found") {
    console.error(
      `[DocCy] No doctor row for slug: "${params.slug}". Redirecting to home.`
    );
    redirect("/");
  }

  if (result.kind === "not_verified") {
    return (
      <ProfileNotLive
        doctorName={result.name}
        verificationStatus={result.verificationStatus}
      />
    );
  }

  const profile = result.profile;

  const { data: settings } = await supabase
    .from("doctor_settings")
    .select("*")
    .eq("doctor_id", profile.id)
    .single();

  const weeklySlots = settings
    ? settingsToWeeklySlots(settings as DoctorSettingsRow)
    : [];

  const breakStart =
    (settings as { break_start?: string | null } | null)?.break_start ?? null;
  const breakEnd =
    (settings as { break_end?: string | null } | null)?.break_end ?? null;

  // Fetch existing appointments (next 7 days) to disable those slots in the UI
  const nowUtc = new Date();
  const { data: existingAppointments } = await supabase
    .from("appointments")
    .select("appointment_datetime")
    .eq("doctor_id", profile.id)
    .gte("appointment_datetime", new Date(nowUtc.getTime() - 60 * 60 * 1000).toISOString())
    .lte(
      "appointment_datetime",
      new Date(nowUtc.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString()
    );

  const takenSlotTimes: string[] = (existingAppointments ?? []).map((a) =>
    format(appointmentToCyprusDate(a.appointment_datetime), "yyyy-MM-dd'T'HH:mm")
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* Background gradient / glow (consistent with landing) */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex gap-5">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-emerald-400/30 shadow-lg shadow-slate-950/50 sm:h-28 sm:w-28">
              <Image
                src={DOCTOR_AVATAR_URL}
                alt=""
                fill
                className="object-cover"
                sizes="112px"
                priority
              />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-emerald-200/80">
                Doc<span className="text-emerald-400">Cy</span> · Doctor profile
              </p>
              <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
                {profile.name}
              </h1>
              <p className="mt-1.5 text-base font-medium capitalize tracking-wide text-emerald-200/95 sm:text-lg">
                {profile.specialty}
              </p>
              {Array.isArray(profile.languages) && profile.languages.length > 0 ? (
                <LanguagesSpoken languages={profile.languages} className="mt-2.5" />
              ) : null}
            </div>
          </div>
          <div className="hidden rounded-full bg-slate-900/60 px-4 py-2 text-xs text-slate-300 backdrop-blur sm:block">
            Premium booking · Cyprus local time
          </div>
        </header>

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(280px,360px)_1fr] lg:gap-8">
          {/* Booking first on mobile, right column on desktop */}
          <section className="order-1 lg:order-2 lg:min-w-0">
            <BookingSection
              doctorId={profile.id}
              doctorName={profile.name}
              weeklySlots={weeklySlots}
              takenSlotTimes={takenSlotTimes}
              profileSlug={params.slug}
              breakStart={breakStart ? breakStart.slice(0, 5) : undefined}
              breakEnd={breakEnd ? breakEnd.slice(0, 5) : undefined}
            />
          </section>

          {/* What to expect: outside About accordion so it stays visible on mobile */}
          <div className="order-2 flex flex-col gap-4 lg:order-1">
            <WhatToExpectCard />
            <DoctorDetailsAccordion
              name={profile.name}
              bio={profile.bio}
              clinicAddress={CLINIC_ADDRESS}
              mapsUrl={MAPS_URL}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

