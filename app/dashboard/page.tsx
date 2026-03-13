// app/dashboard/page.tsx
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { appointmentToCyprusDate, CY_TZ } from "@/lib/appointments";
import { utcToZonedTime } from "date-fns-tz";

export const revalidate = 0;

type AppointmentRow = {
  id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string;
  appointment_datetime: string;
};

function getWhatsAppUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies });

  // MVP: single doctor, load all appointments
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select(
      "id, patient_name, patient_phone, patient_email, appointment_datetime"
    )
    .order("appointment_datetime", { ascending: true });

  if (error) {
    console.error(error);
  }

  const rows =
    (appointments as AppointmentRow[] | null)?.map((a) => {
      const cyDate = appointmentToCyprusDate(a.appointment_datetime);
      return {
        ...a,
        cyDate,
        dateLabel: format(cyDate, "EEE d MMM yyyy", { locale: enGB }),
        timeLabel: format(cyDate, "HH:mm", { locale: enGB }),
        whatsappUrl: getWhatsAppUrl(a.patient_phone),
      };
    }) ?? [];

  const nowUtc = new Date();
  const nowCyprus = utcToZonedTime(nowUtc, CY_TZ);
  const nowLabel = format(nowCyprus, "EEE d MMM yyyy, HH:mm", {
    locale: enGB,
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* Background gradient / glow (consistent with app) */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
              Doctor&apos;s Agenda
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              All appointments in Europe/Nicosia time.
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Current time in Cyprus:{" "}
            <span className="font-mono text-slate-100">{nowLabel}</span>
          </p>
        </header>

        <section className="rounded-3xl border border-emerald-100/10 bg-slate-900/50 shadow-2xl shadow-slate-950/50 backdrop-blur-xl">
          {rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-300 sm:px-6">
              There are no appointments yet.
            </div>
          ) : (
            <>
              {/* Mobile-first: cards layout */}
              <div className="divide-y divide-slate-800/80 md:hidden">
                {rows.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex flex-col gap-3 px-4 py-4 sm:px-5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-50">
                          {appt.patient_name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {appt.dateLabel} · {appt.timeLabel}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-300">
                      <p className="font-medium text-slate-200">
                        Phone:{" "}
                        <span className="font-normal">
                          {appt.patient_phone}
                        </span>
                      </p>
                      {appt.patient_email && (
                        <p className="mt-0.5">
                          Email:{" "}
                          <span className="font-normal">
                            {appt.patient_email}
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="pt-1">
                      {appt.whatsappUrl ? (
                        <a
                          href={appt.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        >
                          Chat on WhatsApp
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">
                          WhatsApp not available
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop / tablet: table layout in glass card */}
              <div className="hidden md:block">
                <table className="min-w-full divide-y divide-slate-800/80">
                  <thead className="bg-slate-900/70">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">
                        Patient name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">
                        Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">
                        WhatsApp
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {rows.map((appt) => (
                      <tr
                        key={appt.id}
                        className="hover:bg-slate-900/70 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-slate-50">
                          {appt.patient_name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-100">
                          {appt.dateLabel}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-100">
                          {appt.timeLabel}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-200">
                          {appt.patient_phone}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {appt.whatsappUrl ? (
                            <a
                              href={appt.whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-2xl bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300"
                            >
                              Chat on WhatsApp
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">
                              Not available
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

