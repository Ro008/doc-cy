import { format } from "date-fns";
import { enUS } from "date-fns/locale";

import { BookingLinkCard, BookingLinkShell, BookingLinkText, BookOnlineButton } from "@/components/booking/BookingLinkPanels";
import { ConfirmBookingRequestClient } from "@/components/booking/ConfirmBookingRequestClient";
import { findDraftByToken, resolveDraftLinkState } from "@/lib/appointment-drafts";
import { isAppointmentLinkTokenShape } from "@/lib/appointment-link-token";
import { professionalSignedInOnPage } from "@/lib/booking-signed-in-guard";
import { draftBookability } from "@/lib/draft-bookability";
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

  // A signed-in professional can't confirm a patient's request (user, 2026-10-07). Nothing is
  // looked up or used up: the patient can still confirm the link signed out.
  if (supabase && (await professionalSignedInOnPage(supabase))) {
    return (
      <BookingLinkShell>
        <BookingLinkCard title="You're signed in as a professional" testId="booking-confirm-professional">
          <BookingLinkText>
            Professionals can&apos;t book or confirm a visit as a patient. This request has not been confirmed. To confirm
            it, open this link while signed out (a private window works), or sign out of DocCy first.
          </BookingLinkText>
        </BookingLinkCard>
      </BookingLinkShell>
    );
  }
  const draft = supabase && isAppointmentLinkTokenShape(token) ? await findDraftByToken(supabase, token).catch(() => null) : null;
  const state = supabase ? await resolveDraftLinkState(supabase, draft).catch(() => "invalid" as const) : "invalid";

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
        : state === "unbooked"
          ? {
              title: "This request wasn't sent",
              body: "The time you picked was no longer free, so nothing was booked. Please choose another time.",
            }
          : state === "replaced"
          ? { title: "You sent a newer request", body: "This request was replaced by a newer one. Use the link in your latest email." }
          : state === "expired"
          ? { title: "This link has expired", body: "Confirmation links work for 30 minutes. Please book your time again." }
          : { title: "This link doesn't work", body: "It may be incomplete or wrong. Open the email again and tap the full link." };
    return (
      <BookingLinkShell>
        <BookingLinkCard title={copy.title} testId={`booking-confirm-${state}`}>
          <BookingLinkText>{copy.body}</BookingLinkText>
          {state === "used" || state === "replaced" ? null : <BookOnlineButton href={bookOnlineHref} />}
        </BookingLinkCard>
      </BookingLinkShell>
    );
  }

  // Never offer "Confirm my request" for a time that's gone or while a request is
  // already waiting (manual test B5, user 2026-10-06). The button's POST checks again.
  const bookable = supabase ? await draftBookability(supabase, draft).catch(() => null) : null;
  if (bookable && !bookable.ok) {
    const copy =
      bookable.code === "slot_taken"
        ? { title: "That time was just booked", body: "Someone else booked this time a moment ago. Please choose another time." }
        : bookable.code === "open_request_exists"
          ? {
              title: "You already have a request",
              body: `You already have a request waiting with ${professionalName}. Please wait for their reply.`,
            }
          : { title: "This time can't be booked any more", body: "Please choose another time." };
    const testCode = bookable.code === "slot_taken" || bookable.code === "open_request_exists" ? bookable.code : "unavailable";
    return (
      <BookingLinkShell>
        <BookingLinkCard title={copy.title} testId={`booking-confirm-${testCode}`}>
          <BookingLinkText>{copy.body}</BookingLinkText>
          {bookable.code === "open_request_exists" ? null : <BookOnlineButton href={bookOnlineHref} />}
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
