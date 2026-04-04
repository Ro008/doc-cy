import { createServiceRoleClient } from "@/lib/supabase-service";
import { appointmentToCyprusDate } from "@/lib/appointments";
import { professionalFirstName } from "@/lib/professional-name";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  RescheduleExpiredPanel,
  RescheduleInvalidPanel,
  ReschedulePickClient,
  RescheduleResolvedPanel,
} from "@/components/reschedule/ReschedulePickClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: { id: string };
  searchParams: { token?: string };
};

function patientGreetingName(fullName: string): string {
  const t = fullName.trim();
  if (!t) return "there";
  return t.split(/\s+/)[0] ?? t;
}

export default async function ReschedulePage({ params, searchParams }: PageProps) {
  const token = searchParams.token?.trim();
  if (!token) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-50">
        <RescheduleInvalidPanel reason="missing_token" />
      </main>
    );
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-50">
        <p className="mx-auto max-w-md text-center text-slate-400">
          Booking is temporarily unavailable.
        </p>
      </main>
    );
  }

  const { data: appt, error } = await supabase
    .from("appointments")
    .select(
      "id, doctor_id, patient_name, status, proposed_slots, proposal_expires_at, reschedule_access_token"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error || !appt) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-50">
        <RescheduleInvalidPanel reason="not_found" />
      </main>
    );
  }

  const st = String(appt.status ?? "").toUpperCase();
  // After a successful pick we clear the token; URL still has ?token=… — check status before token
  // so patients see "already handled" instead of a generic invalid link.
  if (st !== "NEEDS_RESCHEDULE") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-50">
        <RescheduleResolvedPanel />
      </main>
    );
  }

  const rowToken = (appt as { reschedule_access_token?: string | null })
    .reschedule_access_token;
  if (!rowToken || rowToken !== token) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-50">
        <RescheduleInvalidPanel reason="link_revoked" />
      </main>
    );
  }

  const exp = (appt as { proposal_expires_at?: string | null }).proposal_expires_at;
  if (!exp || new Date(exp).getTime() <= Date.now()) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-50">
        <RescheduleExpiredPanel />
      </main>
    );
  }

  const rawSlots = (appt as { proposed_slots?: unknown }).proposed_slots;
  const isoList: string[] = Array.isArray(rawSlots)
    ? rawSlots.filter((x): x is string => typeof x === "string")
    : [];

  if (isoList.length === 0) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-50">
        <RescheduleInvalidPanel reason="no_slots" />
      </main>
    );
  }

  const { data: doctor } = await supabase
    .from("doctors")
    .select("name")
    .eq("id", (appt as { doctor_id: string }).doctor_id)
    .maybeSingle();

  const doctorName = String(doctor?.name ?? "your professional");
  const proFirst = professionalFirstName(doctorName);
  const patientName = String((appt as { patient_name?: string }).patient_name ?? "");
  const patientFirst = patientGreetingName(patientName);

  const expiryCy = appointmentToCyprusDate(exp);
  const expiryLabel = format(expiryCy, "EEEE, d MMMM yyyy 'at' HH:mm", {
    locale: enUS,
  });

  const slots = isoList.map((iso) => ({
    iso,
    label: format(appointmentToCyprusDate(iso), "EEEE, d MMMM yyyy 'at' HH:mm", {
      locale: enUS,
    }),
  }));

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-50 sm:py-16">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-sky-500/10 blur-3xl" />
      </div>
      <ReschedulePickClient
        appointmentId={params.id}
        token={token}
        professionalFirstName={proFirst}
        patientFirstName={patientFirst}
        expiresAtIso={exp}
        expiryLabel={expiryLabel}
        slots={slots}
      />
    </main>
  );
}
