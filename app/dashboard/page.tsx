// app/dashboard/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/db"; // ajusta si usas tipos generados
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import {
  appointmentToCyprusDate,
  CY_TZ,
} from "@/lib/appointments";
import { utcToZonedTime } from "date-fns-tz";

type Status = "pending" | "confirmed" | "cancelled";

function StatusBadge({ status }: { status: Status }) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  if (status === "confirmed") {
    return (
      <span className={`${base} bg-emerald-50 text-emerald-700`}>
        Confirmada
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className={`${base} bg-red-50 text-red-700`}>
        Cancelada
      </span>
    );
  }
  return (
    <span className={`${base} bg-amber-50 text-amber-700`}>
      Pendiente
    </span>
  );
}

export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = createServerComponentClient<Database>({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // Encontrar el doctor asociado a este usuario
  const { data: doctor, error: doctorError } = await supabase
    .from("doctors")
    .select("id, name")
    .eq("auth_user_id", session.user.id)
    .single();

  if (doctorError || !doctor) {
    // Podrías redirigir a un onboarding o mostrar mensaje
    redirect("/onboarding");
  }

  // Citas futuras / próximas en orden cronológico (UTC guardado en BD)
  const nowUtc = new Date();
  const { data: appointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select(
      "id, patient_name, patient_phone, patient_email, appointment_datetime, status"
    )
    .eq("doctor_id", doctor.id)
    .gte("appointment_datetime", nowUtc.toISOString())
    .order("appointment_datetime", { ascending: true });

  if (appointmentsError) {
    console.error(appointmentsError);
  }

  const rows =
    appointments?.map((a) => {
      const cyprusDate = appointmentToCyprusDate(a.appointment_datetime);
      return {
        ...a,
        cyprusDate,
        cyprusFormatted: format(cyprusDate, "EEE d MMM yyyy, HH:mm", {
          locale: enGB,
        }),
      };
    }) ?? [];

  // Fecha/hora actual en Cyprus
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
              Dashboard de {doctor.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Citas próximas (horario Europe/Nicosia).
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Ahora en Cyprus:{" "}
            <span className="font-mono">{nowLabel}</span>
          </p>
        </header>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Fecha y hora
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Paciente
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Contacto
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    No hay citas próximas.
                  </td>
                </tr>
              ) : (
                rows.map((appt) => (
                  <tr key={appt.id} className="hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">
                      {appt.cyprusFormatted}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {appt.patient_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex flex-col">
                        <span>{appt.patient_phone}</span>
                        <span className="text-xs text-slate-500">
                          {appt.patient_email}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={appt.status as Status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

