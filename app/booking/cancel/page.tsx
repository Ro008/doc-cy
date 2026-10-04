import { format } from "date-fns";
import { enUS } from "date-fns/locale";

import { BookingLinkCard, BookingLinkShell, BookingLinkText, BookOnlineButton } from "@/components/booking/BookingLinkPanels";
import { PatientCancelClient } from "@/components/booking/PatientCancelClient";
import { patientCancelDeadlineLabel } from "@/lib/appointment-links-db";
import { appointmentToCyprusDate } from "@/lib/appointments";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import { loadPatientCancelContext } from "@/lib/patient-cancel";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Cancel your appointment | DocCy", robots: { index: false, follow: false } };

/**
 * The page the confirmation email's cancel link opens (user, 2026-10-04). Opening it
 * changes nothing; the button cancels. After the professional's notice deadline it
 * shows the clinic phone instead.
 */
export default async function PatientCancelPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token?.trim() ?? "";
  const service = createServiceRoleClient();
  const ctx = service
    ? await loadPatientCancelContext(service, token).catch(() => ({ kind: "invalid" as const }))
    : ({ kind: "invalid" } as const);

  if (ctx.kind !== "visit") {
    return (
      <BookingLinkShell>
        <BookingLinkCard
          title={ctx.kind === "used" ? "This link was already used" : "This link doesn't work"}
          testId={`patient-cancel-${ctx.kind}`}
        >
          <BookingLinkText>
            {ctx.kind === "used"
              ? "This appointment was already cancelled, or a newer email replaced this link."
              : "It may be incomplete or wrong. Open the email again and tap the full link."}
          </BookingLinkText>
        </BookingLinkCard>
      </BookingLinkShell>
    );
  }

  const bookOnlineHref = ctx.professional.slug ? publicProfessionalProfilePath(ctx.professional.slug) : null;
  const whenLabel = format(appointmentToCyprusDate(ctx.appointment.appointment_datetime), "EEEE, d MMMM yyyy 'at' HH:mm", {
    locale: enUS,
  });
  const clinicLabel = [ctx.clinic.name, ctx.clinic.address].filter(Boolean).join(", ");

  if (String(ctx.appointment.status).toUpperCase() !== "CONFIRMED") {
    return (
      <BookingLinkShell>
        <BookingLinkCard title="This appointment is no longer active" testId="patient-cancel-inactive">
          <BookingLinkText>It was already cancelled. You can book a new time online.</BookingLinkText>
          <BookOnlineButton href={bookOnlineHref} />
        </BookingLinkCard>
      </BookingLinkShell>
    );
  }

  if (ctx.windowClosed) {
    // The one place DocCy points a patient at a phone call (user, 2026-10-04).
    return (
      <BookingLinkShell>
        <BookingLinkCard title="Online cancellation has closed" testId="patient-cancel-closed">
          <BookingLinkText>
            Your visit with {ctx.professional.name} is on {whenLabel}. It&apos;s too close to the visit to cancel online;
            please call {ctx.clinic.name}:
          </BookingLinkText>
          {ctx.clinic.phone ? (
            <a href={`tel:${ctx.clinic.phone}`} className="mt-4 inline-block text-lg font-semibold text-clinical-300">
              {ctx.clinic.phone}
            </a>
          ) : null}
        </BookingLinkCard>
      </BookingLinkShell>
    );
  }

  return (
    <BookingLinkShell>
      <PatientCancelClient
        token={token}
        professionalName={ctx.professional.name}
        whenLabel={whenLabel}
        clinicLabel={clinicLabel}
        deadlineLabel={patientCancelDeadlineLabel(ctx.appointment.appointment_datetime, ctx.noticeHours)}
        bookOnlineHref={bookOnlineHref}
      />
    </BookingLinkShell>
  );
}
