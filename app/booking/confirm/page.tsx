import { format } from "date-fns";
import { enUS } from "date-fns/locale";

import { BookingLinkCard, BookingLinkShell, BookingLinkText, BookOnlineButton } from "@/components/booking/BookingLinkPanels";
import { ConfirmBookingRequestClient } from "@/components/booking/ConfirmBookingRequestClient";
import { draftLinkState, findDraftByToken } from "@/lib/appointment-drafts";
import { isAppointmentLinkTokenShape } from "@/lib/appointment-link-token";
import { appointmentToCyprusDate } from "@/lib/appointments";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Confirm your request | DocCy", robots: { index: false, follow: false } };

/**
 * The page the booking confirmation email opens (user, 2026-10-02). Opening it changes
 * nothing; the "Confirm my request" button does (email scanners open links).
 */
export default async function ConfirmBookingRequestPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token?.trim() ?? "";
  const supabase = createServiceRoleClient();
  const draft = supabase && isAppointmentLinkTokenShape(token) ? await findDraftByToken(supabase, token).catch(() => null) : null;
  const state = draftLinkState(draft);

  let professionalName = "your professional";
  let bookOnlineHref: string | null = null;
  let clinicLabel = "";
  if (draft && supabase) {
    const [{ data: professional }, { data: clinic }] = await Promise.all([
      supabase.from("professionals").select("name, slug").eq("id", draft.professional_id).maybeSingle(),
      supabase.from("clinics").select("name, address").eq("id", draft.clinic_id).maybeSingle(),
    ]);
    professionalName = String((professional as { name?: string } | null)?.name ?? professionalName);
    const slug = String((professional as { slug?: string } | null)?.slug ?? "").trim();
    bookOnlineHref = slug ? publicProfessionalProfilePath(slug) : null;
    const c = clinic as { name?: string | null; address?: string | null } | null;
    clinicLabel = [c?.name, c?.address].filter(Boolean).join(", ");
  }

  if (state !== "usable" || !draft) {
    const copy =
      state === "used"
        ? { title: "Already confirmed", body: "This request was already confirmed. You'll get an email when the professional replies." }
        : state === "expired"
          ? { title: "This link has expired", body: "Confirmation links work for 30 minutes. Please book your time again." }
          : { title: "This link doesn't work", body: "It may be incomplete or wrong. Open the email again and tap the full link." };
    return (
      <BookingLinkShell>
        <BookingLinkCard title={copy.title} testId={`booking-confirm-${state}`}>
          <BookingLinkText>{copy.body}</BookingLinkText>
          {state === "used" ? null : <BookOnlineButton href={bookOnlineHref} />}
        </BookingLinkCard>
      </BookingLinkShell>
    );
  }

  const whenLabel = format(appointmentToCyprusDate(draft.appointment_datetime), "EEEE, d MMMM yyyy 'at' HH:mm", {
    locale: enUS,
  });

  return (
    <BookingLinkShell>
      <ConfirmBookingRequestClient
        token={token}
        professionalName={professionalName}
        whenLabel={whenLabel}
        clinicLabel={clinicLabel}
        bookOnlineHref={bookOnlineHref}
      />
    </BookingLinkShell>
  );
}
