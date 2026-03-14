// app/[slug]/page.tsx
import Image from "next/image";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BookingSection } from "@/components/doctor/BookingSection";
import {
  settingsToWeeklySlots,
  type DoctorSettingsRow,
} from "@/lib/doctor-settings";
import { appointmentToCyprusDate } from "@/lib/appointments";
import { format } from "date-fns";

const DOCTOR_AVATAR_URL =
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop";
const CLINIC_ADDRESS =
  "Evangelismos Private Hospital, 87 Vasileos Constantinou Ave, Paphos";
const MAPS_URL =
  "https://maps.google.com/?q=Evangelismos+Private+Hospital+Paphos";

type PageProps = {
  params: { slug: string };
};

export const revalidate = 0;

export async function generateMetadata(
  { params }: PageProps
): Promise<Metadata> {
  const { data: doctor } = await supabase
    .from("doctors")
    .select("name, specialty")
    .eq("slug", params.slug)
    .single();

  if (!doctor) {
    return {
      title: "Doctor not found | DocCy",
    };
  }

  return {
    title: `${doctor.name} – ${doctor.specialty} | DocCy`,
    description: `Book an appointment with ${doctor.name}, ${doctor.specialty} in Cyprus via DocCy.`,
  };
}

export default async function DoctorPage({ params }: PageProps) {
  const { data: doctor, error: doctorError } = await supabase
    .from("doctors")
    .select("id, name, specialty, bio, clinic_address, slug")
    .eq("slug", params.slug)
    .single();

  if (doctorError || !doctor) {
    console.error(
      `[DocCy] Doctor not found for slug: "${params.slug}". Redirecting to home.`
    );
    redirect("/");
  }

  const { data: settings } = await supabase
    .from("doctor_settings")
    .select("*")
    .eq("doctor_id", doctor.id)
    .single();

  const weeklySlots = settings
    ? settingsToWeeklySlots(settings as DoctorSettingsRow)
    : [];

  // Fetch existing appointments (next 7 days) to disable those slots in the UI
  const nowUtc = new Date();
  const { data: existingAppointments } = await supabase
    .from("appointments")
    .select("appointment_datetime")
    .eq("doctor_id", doctor.id)
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
                {doctor.name}
              </h1>
              <p className="mt-2 text-sm text-slate-300 sm:text-base">
                {doctor.specialty}
              </p>
            </div>
          </div>
          <div className="hidden rounded-full bg-slate-900/60 px-4 py-2 text-xs text-slate-300 backdrop-blur sm:block">
            Premium booking · Cyprus local time
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr] lg:gap-8">
          {/* Doctor info: mínima anchura necesaria para buena UX */}
          <section className="lg:min-w-0">
            <div className="rounded-3xl border border-emerald-100/10 bg-slate-900/50 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur-xl sm:p-7">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.2em] text-slate-400">
                    About
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {doctor.bio ?? "This doctor has not added a bio yet."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                    <p className="text-xs font-semibold tracking-wide text-slate-400">
                      Specialty
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-100">
                      {doctor.specialty}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                    <p className="text-xs font-semibold tracking-wide text-slate-400">
                      Location
                    </p>
                    <a
                      href={MAPS_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 flex items-start gap-2 text-sm text-slate-200 transition hover:text-emerald-300"
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/80" />
                      <span>{CLINIC_ADDRESS}</span>
                    </a>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                  <p className="text-xs font-semibold tracking-[0.2em] text-emerald-200/80">
                    What to expect
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Book in seconds. You’ll receive a WhatsApp-friendly contact
                    flow and your appointment will appear instantly in the
                    doctor’s agenda.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Booking: columna principal, calendario amplio */}
          <section className="lg:min-w-0">
            <BookingSection
              doctorId={doctor.id}
              doctorName={doctor.name}
              weeklySlots={weeklySlots}
              takenSlotTimes={takenSlotTimes}
              profileSlug={params.slug}
            />
          </section>
        </div>
      </div>
    </main>
  );
}

