// app/[slug]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { BookingSection } from "@/components/doctor/BookingSection";

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
    return notFound();
  }

  const { data: slots } = await supabase
    .from("slots")
    .select("id, day_of_week, start_time, end_time, duration")
    .eq("doctor_id", doctor.id)
    .order("day_of_week", { ascending: true });

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 md:px-8 lg:flex-row">
        <section className="flex-1 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
            DocCy doctor profile
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {doctor.name}
          </h1>
          <p className="text-lg font-medium text-sky-700">
            {doctor.specialty}
          </p>
          {doctor.clinic_address && (
            <p className="text-sm text-slate-600">
              {doctor.clinic_address}
            </p>
          )}
          {doctor.bio && (
            <p className="mt-4 text-sm leading-relaxed text-slate-700">
              {doctor.bio}
            </p>
          )}
        </section>

        <section className="w-full max-w-md">
          <BookingSection
            doctorId={doctor.id}
            doctorName={doctor.name}
            weeklySlots={slots ?? []}
          />
        </section>
      </div>
    </main>
  );
}

