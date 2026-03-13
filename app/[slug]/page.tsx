// app/[slug]/page.tsx
import { redirect } from "next/navigation";
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
    console.error(
      `[DocCy] Doctor not found for slug: "${params.slug}". Redirecting to home.`
    );
    redirect("/");
  }

  const { data: slots } = await supabase
    .from("slots")
    .select("id, day_of_week, start_time, end_time, duration")
    .eq("doctor_id", doctor.id)
    .order("day_of_week", { ascending: true });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* Background gradient / glow (consistent with landing) */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
              DocCy · Doctor profile
            </p>
            <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
              {doctor.name}
            </h1>
            <p className="mt-2 text-sm text-slate-300 sm:text-base">
              {doctor.specialty}
            </p>
          </div>
          <div className="hidden rounded-full bg-slate-900/60 px-4 py-2 text-xs text-slate-300 backdrop-blur sm:block">
            Premium booking · Cyprus local time
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Doctor info (glass card) */}
          <section className="lg:col-span-3">
            <div className="rounded-3xl border border-emerald-100/10 bg-slate-900/50 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur-xl sm:p-7">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    About
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {doctor.bio ?? "This doctor has not added a bio yet."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Specialty
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-100">
                      {doctor.specialty}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Address
                    </p>
                    <p className="mt-2 text-sm text-slate-200">
                      {doctor.clinic_address ?? "Address not provided"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
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

          {/* Booking (right column) */}
          <section className="lg:col-span-2">
            <BookingSection
              doctorId={doctor.id}
              doctorName={doctor.name}
              weeklySlots={slots ?? []}
            />
          </section>
        </div>
      </div>
    </main>
  );
}

