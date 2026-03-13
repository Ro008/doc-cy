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
  // Expecting international format with country code
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies });

  // For the MVP we assume a single doctor, so we load all appointments.
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
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
        <header className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Doctor&apos;s Agenda
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              All appointments in Europe/Nicosia time.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Current time in Cyprus:{" "}
            <span className="font-mono">{nowLabel}</span>
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              There are no appointments yet.
            </div>
          ) : (
            <>
              {/* Mobile-first: cards layout */}
              <div className="divide-y divide-slate-100 md:hidden">
                {rows.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex flex-col gap-3 px-4 py-4"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {appt.patient_name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {appt.dateLabel} · {appt.timeLabel}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600">
                      <p className="font-medium text-slate-700">
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
                          className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                        >
                          Chat on WhatsApp
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">
                          WhatsApp not available
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop / tablet: table layout */}
              <div className="hidden md:block">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Patient name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        WhatsApp
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((appt) => (
                      <tr key={appt.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-sm text-slate-900">
                          {appt.patient_name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">
                          {appt.dateLabel}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">
                          {appt.timeLabel}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-800">
                          {appt.patient_phone}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {appt.whatsappUrl ? (
                            <a
                              href={appt.whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                            >
                              Chat on WhatsApp
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">
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

