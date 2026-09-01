import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { format } from "date-fns";
import { addMinutes } from "date-fns";
import { enUS } from "date-fns/locale";
import { appointmentToCyprusDate } from "@/lib/appointments";
import { professionalFirstName } from "@/lib/professional-name";
import {
  buildWeeklyScheduleFromSettings,
  type DoctorSettingsRow,
} from "@/lib/doctor-settings";
import { AppointmentReviewClient } from "@/components/dashboard/AppointmentReviewClient";
import { PendingLink } from "@/components/navigation/PendingLink";
import { buildGoogleCalendarUrl } from "@/lib/patient-calendar-event";
import { getDoctorCalendarEventDetails } from "@/lib/doctor-calendar-event";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { params: { id: string }; searchParams?: { confirmed?: string } };

const PRIMARY_BTN_CLASS =
  "flex w-full items-center justify-center rounded-2xl bg-clinical-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-clinical-500/20 transition hover:bg-clinical-400";
const SECONDARY_BTN_CLASS =
  "flex w-full items-center justify-center rounded-2xl border border-clinical-400/35 bg-clinical-500/10 px-4 py-3 text-sm font-semibold text-clinical-100 transition hover:border-clinical-400/50 hover:bg-clinical-500/20";

function DoctorAppointmentLinkShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-ink-900 text-ink-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-clinical-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-clinical-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-clinical-400/10 blur-3xl" />
      </div>
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="rounded-3xl border border-clinical-100/10 bg-ink-900/70 p-6 shadow-2xl shadow-ink-900/50 backdrop-blur-xl sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}

function DoctorLinkStatePanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <DoctorAppointmentLinkShell>
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
        Link no longer actionable
      </p>
      <h1 className="mt-2 text-xl font-semibold text-ink-50">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-300">{description}</p>
      <div className="mt-6 flex flex-col gap-2">
        <PendingLink href="/agenda" className={PRIMARY_BTN_CLASS}>
          Open agenda
        </PendingLink>
        <PendingLink href="/agenda/settings" className={SECONDARY_BTN_CLASS}>
          Open settings
        </PendingLink>
      </div>
    </DoctorAppointmentLinkShell>
  );
}

export default async function DashboardAppointmentDetailPage({
  params,
  searchParams,
}: PageProps) {
  const appointmentId = String(params.id ?? "").trim();
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.info("[DocCy][doctor-link] unauthenticated_access", {
      appointmentId,
      path: `/dashboard/appointments/${appointmentId}`,
    });
    redirect("/login");
  }

  const { data: doctor, error: doctorErr } = await supabase
    .from("professionals")
    .select("id, name")
    .eq("auth_user_id", user.id)
    .single();

  if (doctorErr || !doctor) {
    console.warn("[DocCy][doctor-link] doctor_not_found_for_user", {
      userId: user.id,
      appointmentId,
    });
    redirect("/login");
  }

  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select(
      "id, patient_name, patient_phone, appointment_datetime, status, reason, duration_minutes, proposal_expires_at, proposed_slots"
    )
    .eq("id", appointmentId)
    .eq("doctor_id", doctor.id)
    .maybeSingle();

  if (apptErr || !appt) {
    console.info("[DocCy][doctor-link] not_found_or_forbidden", {
      userId: user.id,
      doctorId: doctor.id,
      appointmentId,
      dbError: apptErr?.message ?? null,
    });
    return (
      <DoctorLinkStatePanel
        title="This confirmation link is no longer available"
        description="This request may have already been handled, removed, or it may belong to another account. You can continue from your DocCy agenda."
      />
    );
  }

  const { data: settingsRow } = await supabase
    .from("doctor_settings")
    .select(
      "slot_duration_minutes, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, weekly_schedule, break_start, break_end"
    )
    .eq("doctor_id", doctor.id)
    .maybeSingle();

  const settingsTyped = settingsRow as DoctorSettingsRow | null;
  const slotDefault = settingsTyped?.slot_duration_minutes ?? 30;
  const initialDurationMinutes = Number(
    (appt as { duration_minutes?: number | null }).duration_minutes ?? slotDefault
  );

  const cy = appointmentToCyprusDate(appt.appointment_datetime as string);
  const agendaDateKey = format(cy, "yyyy-MM-dd");
  const dateStr = format(cy, "EEEE, d MMMM yyyy", { locale: enUS });
  const timeStr = format(cy, "HH:mm");
  const greet = professionalFirstName(doctor.name);
  const status = String(appt.status);
  const justConfirmed = searchParams?.confirmed === "1";
  const reason = String((appt as { reason?: string | null }).reason ?? "");
  const patientName = appt.patient_name as string;
  const patientPhone = String((appt as { patient_phone?: string | null }).patient_phone ?? "");
  const googleCalendarUrl = buildGoogleCalendarUrl({
    ...getDoctorCalendarEventDetails(
      {
        patient_name: patientName,
        patient_phone: patientPhone || null,
      },
      {
        name: doctor.name,
      },
      {
        reason,
        visitType: null,
        visitNotes: null,
      },
    ),
    startUtc: new Date(appt.appointment_datetime as string),
    endUtc: addMinutes(
      new Date(appt.appointment_datetime as string),
      initialDurationMinutes,
    ),
  });
  const doctorIcsUrl = `/api/appointments/${encodeURIComponent(appt.id as string)}/calendar?audience=doctor`;

  const scheduleForReview =
    settingsTyped != null
      ? {
          weeklySchedule: buildWeeklyScheduleFromSettings(settingsTyped),
          breakStart: settingsTyped.break_start,
          breakEnd: settingsTyped.break_end,
        }
      : null;

  if (status === "NEEDS_RESCHEDULE") {
    console.info("[DocCy][doctor-link] reopened_after_action", {
      userId: user.id,
      doctorId: doctor.id,
      appointmentId,
      status,
    });
    const expRaw = (appt as { proposal_expires_at?: string | null })
      .proposal_expires_at;
    const expLabel = expRaw
      ? format(appointmentToCyprusDate(expRaw), "EEEE, d MMMM yyyy 'at' HH:mm", {
          locale: enUS,
        })
      : null;
    const rawSlots = (appt as { proposed_slots?: unknown }).proposed_slots;
    const slotCount = Array.isArray(rawSlots) ? rawSlots.length : 0;

    return (
      <DoctorAppointmentLinkShell>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
          Awaiting patient
        </p>
        <h1 className="mt-2 text-xl font-semibold text-ink-50">Hi {greet}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">
          {patientName} has been sent a link to choose among{" "}
          {slotCount > 0 ? `${slotCount} proposed times` : "proposed times"}.
          {expLabel ? (
            <>
              {" "}
              They should respond before{" "}
              <span className="font-medium text-amber-200">{expLabel}</span> (Cyprus time).
            </>
          ) : null}
        </p>
        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">
              Original request
            </dt>
            <dd className="mt-0.5 text-ink-100">
              {dateStr} · {timeStr} (Cyprus time)
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Reason</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-ink-200">{reason || "—"}</dd>
          </div>
        </dl>
        <PendingLink href="/agenda" className={`mt-8 ${PRIMARY_BTN_CLASS}`}>
          Open agenda
        </PendingLink>
      </DoctorAppointmentLinkShell>
    );
  }

  if (status === "REQUESTED") {
    console.info("[DocCy][doctor-link] opened_pending_request", {
      userId: user.id,
      doctorId: doctor.id,
      appointmentId,
      status,
    });
    return (
      <DoctorAppointmentLinkShell>
        <AppointmentReviewClient
            appointmentId={appt.id as string}
            appointmentDatetimeIso={appt.appointment_datetime as string}
            professionalFirstName={greet}
            patientName={patientName}
            requestedDateLabel={dateStr}
            requestedTimeLabel={timeStr}
            reason={reason}
            initialDurationMinutes={initialDurationMinutes}
            scheduleForReview={scheduleForReview}
        />
      </DoctorAppointmentLinkShell>
    );
  }

  if (status === "CONFIRMED" || status === "CANCELLED") {
    console.info("[DocCy][doctor-link] reopened_non_actionable_status", {
      userId: user.id,
      doctorId: doctor.id,
      appointmentId,
      status,
    });
  }

  return (
    <DoctorAppointmentLinkShell>
      <p className="text-xs font-semibold uppercase tracking-wide text-clinical-300">
        {justConfirmed ? "Appointment confirmed" : "Appointment"}
      </p>
      <h1 className="mt-2 text-xl font-semibold text-ink-50">Hi {greet}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-300">
          {status === "CONFIRMED" && justConfirmed
            ? "Confirmed in DocCy. Manage all updates in DocCy in a few clicks. Google Calendar is only an optional reminder and does not sync changes."
            : status === "CONFIRMED"
              ? "This visit is already confirmed. Manage all updates in DocCy."
              : status === "CANCELLED"
                ? "This appointment was cancelled."
                : "This request is not pending confirmation."}
        </p>
        {status === "CONFIRMED" ? (
          <div className="mt-5 space-y-2">
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={PRIMARY_BTN_CLASS}
            >
              Add to Google Calendar
            </a>
            <a href={doctorIcsUrl} className={SECONDARY_BTN_CLASS}>
              Add to Apple / Outlook (.ics)
            </a>
          </div>
        ) : null}

        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Patient</dt>
            <dd className="mt-0.5 text-ink-100">{patientName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">When</dt>
            <dd className="mt-0.5 text-ink-100">
              {dateStr} · {timeStr} (Cyprus time)
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Status</dt>
            <dd className="mt-0.5 text-ink-100">{status}</dd>
          </div>
          {status === "CONFIRMED" ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Duration
              </dt>
              <dd className="mt-0.5 text-ink-100">{initialDurationMinutes} minutes</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Reason</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-ink-200">{reason || "—"}</dd>
          </div>
        </dl>

        <PendingLink
          href={`/agenda?date=${agendaDateKey}`}
          className="mt-8 flex w-full items-center justify-center rounded-2xl px-3 py-2 text-sm font-medium text-ink-500 transition hover:bg-clinical-500/10 hover:text-clinical-200"
        >
          Open that day in agenda
        </PendingLink>
    </DoctorAppointmentLinkShell>
  );
}
