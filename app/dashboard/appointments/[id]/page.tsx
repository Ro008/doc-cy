import { redirect } from "next/navigation";
import { PreviousVisitsList } from "@/components/dashboard/PreviousVisitsList";
import { loadPreviousVisits } from "@/lib/previous-visits";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { format } from "date-fns";
import { addMinutes } from "date-fns";
import { enUS } from "date-fns/locale";
import { appointmentToCyprusDate } from "@/lib/appointments";
import { professionalFirstName } from "@/lib/professional-name";
import { locationWeeklySchedule } from "@/lib/doctor-locations";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import { linkIdForClinic, clinicForAppointment, clinicSlotMinutes } from "@/lib/professional-account-settings";
import { AppointmentReviewClient } from "@/components/dashboard/AppointmentReviewClient";
import { PendingLink } from "@/components/navigation/PendingLink";
import { buildGoogleCalendarUrl } from "@/lib/patient-calendar-event";
import { getDoctorCalendarEventDetails } from "@/lib/doctor-calendar-event";
import { appointmentCalendarPath } from "@/lib/appointment-links";
import { formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import { confirmedExitLinks, reviewBackTarget, wantsSuggestOnOpen, type ReviewDayRow } from "@/lib/appointment-review";
import { isExpiredRequest, isStoredExpiredStatus } from "@/lib/appointment-status";
import { agendaHighlightHref } from "@/lib/agenda-highlight";
import { awaitingPatientSummary, requestedAgoLabel, todayWorkingWindow } from "@/lib/doctor-dashboard";
import { clinicIdForAppointment, locationsToAgendaClinics } from "@/lib/agenda-clinics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: { id: string };
  searchParams?: { confirmed?: string; intent?: string; from?: string };
};

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
      <div className="mx-auto max-w-xl px-4 py-10">
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
      "id, patient_name, patient_email, patient_phone, patient_gender, patient_birthdate, appointment_datetime, status, reason, duration_minutes, proposal_expires_at, proposed_slots, created_at, is_new_patient, clinic_id"
    )
    .eq("id", appointmentId)
    .eq("professional_id", doctor.id)
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

  // The appointment's clinic schedule (Point E6: schedules live on the clinic links).
  const locations = await loadDoctorLocations(doctor.id);
  const apptClinicId = (appt as { clinic_id?: string | null }).clinic_id ?? null;
  // Her link at the appointment's clinic (appointments.clinic_id = clinics.id).
  const apptLocationId = linkIdForClinic(locations, apptClinicId);
  const appointmentClinic = clinicForAppointment(locations, apptLocationId);
  const slotDefault = clinicSlotMinutes(locations, apptLocationId);
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
  const doctorIcsUrl = appointmentCalendarPath(appt.id as string, "professional") ?? "";

  const scheduleForReview =
    appointmentClinic != null
      ? {
          weeklySchedule: locationWeeklySchedule(appointmentClinic),
          breakStart: appointmentClinic.break_start,
          breakEnd: appointmentClinic.break_end,
        }
      : null;

  // Waiting for the patient. A lapsed proposal becomes EXPIRED (scheduled job); there is
  // no re-suggesting (user, 2026-10-04: no ping-pong).
  if (status === "NEEDS_RESCHEDULE") {
    console.info("[DocCy][doctor-link] reopened_after_action", {
      userId: user.id,
      doctorId: doctor.id,
      appointmentId,
      status,
    });
    const summary = awaitingPatientSummary({
      id: appt.id as string,
      appointment_datetime: appt.appointment_datetime as string,
      proposed_slots: (appt as { proposed_slots?: unknown }).proposed_slots,
      proposal_expires_at: (appt as { proposal_expires_at?: string | null }).proposal_expires_at ?? null,
    });
    const back = reviewBackTarget(searchParams?.from);

    return (
      <DoctorAppointmentLinkShell>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Awaiting patient</p>
        <h1 className="mt-2 text-xl font-semibold leading-snug text-ink-50 sm:text-2xl">
          Waiting for {patientName} to pick a time
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">
          You suggested these times; they stay held in your agenda until {patientName} chooses one
          {summary.expiresLabel ? (
            <>
              {" "}or the offer expires on{" "}
              <span className="font-medium text-amber-200">{summary.expiresLabel}</span>
            </>
          ) : null}
          . <span className="text-ink-500">Cyprus time.</span>
        </p>

        {summary.slotLabels.length > 0 ? (
          <ul data-testid="review-proposed-times" className="mt-5 space-y-2 text-sm">
            {summary.slotLabels.map((label, i) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-xl border border-clinical-400/25 bg-clinical-500/10 px-3 py-2 text-ink-50"
              >
                <span className="text-xs font-semibold text-clinical-300">{i + 1}</span>
                <span className="tabular-nums">{label}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Original request</dt>
            <dd className="mt-0.5 text-ink-300 line-through decoration-ink-500/60">
              {dateStr} · {timeStr}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Reason</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-ink-200">{reason || "—"}</dd>
          </div>
        </dl>

        <PendingLink href={summary.agendaHref} className={`mt-8 ${PRIMARY_BTN_CLASS}`}>
          Open in agenda
        </PendingLink>
        <PendingLink
          href={back.href}
          className="mt-3 block text-center text-sm text-ink-400 underline-offset-2 hover:text-ink-200 hover:underline"
        >
          {back.label}
        </PendingLink>
      </DoctorAppointmentLinkShell>
    );
  }

  // Unanswered request whose time has passed (or closed as EXPIRED): nothing to confirm.
  if (isExpiredRequest({ status, startIso: appt.appointment_datetime as string })) {
    const back = reviewBackTarget(searchParams?.from);
    const agendaHref = agendaHighlightHref(
      formatInTimeZone(new Date(appt.appointment_datetime as string), CY_TZ, "yyyy-MM-dd"),
      appt.id as string,
    );
    return (
      <DoctorAppointmentLinkShell>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Expired request</p>
        <h1 className="mt-2 text-xl font-semibold leading-snug text-ink-50 sm:text-2xl">This request expired</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">
          {patientName} asked for {dateStr} · {timeStr}, but nobody answered before the visit time.
          {isStoredExpiredStatus(status)
            ? " It has been closed."
            : " We'll let them know they can book again online."}{" "}
          <span className="text-ink-500">Cyprus time.</span>
        </p>
        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Reason</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-ink-200">{reason || "—"}</dd>
          </div>
        </dl>
        {isStoredExpiredStatus(status) ? null : (
          <PendingLink href={agendaHref} className={`mt-8 ${PRIMARY_BTN_CLASS}`}>
            Open in agenda
          </PendingLink>
        )}
        <PendingLink
          href={back.href}
          className="mt-3 block text-center text-sm text-ink-400 underline-offset-2 hover:text-ink-200 hover:underline"
        >
          {back.label}
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
    const startIso = appt.appointment_datetime as string;
    const dayKey = formatInTimeZone(new Date(startIso), CY_TZ, "yyyy-MM-dd");
    const dayStartUtc = zonedTimeToUtc(`${dayKey}T00:00:00`, CY_TZ).toISOString();
    const dayEndUtc = zonedTimeToUtc(`${dayKey}T23:59:59.999`, CY_TZ).toISOString();

    const [{ data: dayRows }, locationRows, previousVisits] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, appointment_datetime, patient_name, status, duration_minutes")
        .eq("professional_id", doctor.id)
        .gte("appointment_datetime", dayStartUtc)
        .lte("appointment_datetime", dayEndUtc)
        .order("appointment_datetime", { ascending: true }),
      loadDoctorLocations(doctor.id),
      loadPreviousVisits(supabase, {
        professionalId: doctor.id,
        appointmentId: appt.id as string,
        email: (appt as { patient_email?: string | null }).patient_email ?? null,
        phone: patientPhone || null,
      }),
    ]);

    const clinics = locationsToAgendaClinics(locationRows);
    const locationId = linkIdForClinic(locationRows, apptClinicId);
    const clinicName =
      clinics.length > 1
        ? clinics.find((c) => c.id === clinicIdForAppointment(apptClinicId, clinics))?.name ?? null
        : null;
    const hoursList =
      clinics.length > 0
        ? clinics.map((c) => c.hours)
        : scheduleForReview
          ? [{ ...scheduleForReview, slotDurationMinutes: slotDefault }]
          : [];
    const dayWindow = todayWorkingWindow(hoursList, new Date(startIso).getTime());
    const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;

    return (
      <DoctorAppointmentLinkShell>
        <AppointmentReviewClient
          appointmentId={appt.id as string}
          appointmentDatetimeIso={startIso}
          patientName={patientName}
          isNewPatient={(appt as { is_new_patient?: boolean | null }).is_new_patient === true}
          patient={{
            birthdate: (appt as { patient_birthdate?: string | null }).patient_birthdate ?? null,
            gender: (appt as { patient_gender?: string | null }).patient_gender ?? null,
            isNewPatient: (appt as { is_new_patient?: boolean | null }).is_new_patient ?? null,
            phone: patientPhone || null,
            email: (appt as { patient_email?: string | null }).patient_email ?? null,
          }}
          requestedAgo={requestedAgoLabel((appt as { created_at?: string | null }).created_at, Date.now())}
          clinicName={clinicName}
          dayLabel={formatInTimeZone(new Date(startIso), CY_TZ, "EEE d MMM")}
          dayHoursLabel={
            dayWindow ? `Your hours: ${pad(dayWindow.startHour)}–${pad(dayWindow.endHour)}` : "You're not working that day"
          }
          dayRows={(dayRows ?? []) as ReviewDayRow[]}
          reason={reason}
          initialDurationMinutes={initialDurationMinutes}
          scheduleForReview={scheduleForReview}
          back={reviewBackTarget(searchParams?.from)}
          openSuggestions={wantsSuggestOnOpen(searchParams?.intent)}
          locationId={locationId}
          clinicOptions={locationRows.map((l) => ({ id: l.id, name: l.clinic_name ?? "Clinic" }))}
        />
        <PreviousVisitsList
          visits={previousVisits}
          clinicName={(id) => (clinics.length > 1 ? clinics.find((c) => c.clinicId === id)?.name ?? null : null)}
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

  const exitLinks = confirmedExitLinks(searchParams?.from, {
    dateKey: agendaDateKey,
    label: formatInTimeZone(new Date(appt.appointment_datetime as string), CY_TZ, "EEE d MMM"),
  });

  return (
    <DoctorAppointmentLinkShell>
      <p className="text-xs font-semibold uppercase tracking-wide text-clinical-300">
        {justConfirmed ? "Visit confirmed" : "Appointment"}
      </p>
      <h1 className="mt-2 text-xl font-semibold text-ink-50">
        {justConfirmed ? `${patientName} is booked` : `Hi ${greet}`}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-300">
        {status === "CONFIRMED" && justConfirmed
          ? "The visit is in your agenda and the patient has been emailed."
          : status === "CONFIRMED"
            ? "This visit is already confirmed. Manage all updates in DocCy."
            : status === "CANCELLED"
              ? "This appointment was cancelled."
              : "This request is not pending confirmation."}
      </p>

      <div className="mt-5 space-y-2">
        <PendingLink href={exitLinks.primary.href} className={PRIMARY_BTN_CLASS}>
          {exitLinks.primary.label}
        </PendingLink>
        <PendingLink href={exitLinks.secondary.href} className={SECONDARY_BTN_CLASS}>
          {exitLinks.secondary.label}
        </PendingLink>
      </div>

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
        {status === "CONFIRMED" ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Duration</dt>
            <dd className="mt-0.5 text-ink-100">{initialDurationMinutes} minutes</dd>
          </div>
        ) : (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Status</dt>
            <dd className="mt-0.5 text-ink-100">{status}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Reason</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-ink-200">{reason || "—"}</dd>
        </div>
      </dl>

      {status === "CONFIRMED" ? (
        <p className="mt-6 text-xs text-ink-500">
          Optional reminder (it does not sync later changes):{" "}
          <a
            href={googleCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-clinical-300 underline underline-offset-2 hover:text-clinical-200"
          >
            Google Calendar
          </a>
          {" · "}
          <a
            href={doctorIcsUrl}
            className="font-medium text-clinical-300 underline underline-offset-2 hover:text-clinical-200"
          >
            Apple / Outlook (.ics)
          </a>
        </p>
      ) : null}
    </DoctorAppointmentLinkShell>
  );
}
