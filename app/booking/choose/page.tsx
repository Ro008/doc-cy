import { format } from "date-fns";
import { enUS } from "date-fns/locale";

import { BookingLinkCard, BookingLinkShell, BookingLinkText, BookOnlineButton } from "@/components/booking/BookingLinkPanels";
import { ChooseProposalClient } from "@/components/booking/ChooseProposalClient";
import { appointmentToCyprusDate } from "@/lib/appointments";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import { professionalSignedInOnPage } from "@/lib/booking-signed-in-guard";
import { loadPatientProposalContext } from "@/lib/patient-proposal";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Choose a time | DocCy", robots: { index: false, follow: false } };

const LABEL = "EEEE, d MMMM yyyy 'at' HH:mm";

/**
 * The page the proposal email opens (user, 2026-10-04): pick one of the 1-3 times the
 * professional reserved, or decline them. Opening it changes nothing.
 */
export default async function ChooseProposalPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token?.trim() ?? "";
  const service = createServiceRoleClient();

  // A signed-in professional can't answer a patient's proposal (user, 2026-10-07). Nothing is
  // looked up or used up: the patient can still use the link signed out.
  if (service && (await professionalSignedInOnPage(service))) {
    return (
      <BookingLinkShell>
        <BookingLinkCard title="You're signed in as a professional" testId="choose-professional">
          <BookingLinkText>
            Professionals can&apos;t answer a proposal as a patient. Nothing has been chosen or declined. To answer
            it, open this link while signed out (a private window works), or sign out of DocCy first.
          </BookingLinkText>
        </BookingLinkCard>
      </BookingLinkShell>
    );
  }

  const ctx = service
    ? await loadPatientProposalContext(service, token).catch(() => ({ kind: "invalid" as const }))
    : ({ kind: "invalid" } as const);

  if (ctx.kind !== "proposal") {
    const bookOnlineHref = "professionalSlug" in ctx && ctx.professionalSlug ? publicProfessionalProfilePath(ctx.professionalSlug) : null;
    const copy =
      ctx.kind === "expired"
        ? { title: "These times have expired", body: "You didn't choose in time, so the reserved times were released. You can book a new time online." }
        : ctx.kind === "used"
          ? { title: "Already answered", body: "This proposal was already answered." }
          : { title: "This link doesn't work", body: "It may be incomplete or wrong. Open the email again and tap the full link." };
    return (
      <BookingLinkShell>
        <BookingLinkCard title={copy.title} testId={`choose-${ctx.kind}`}>
          <BookingLinkText>{copy.body}</BookingLinkText>
          {ctx.kind === "invalid" ? null : <BookOnlineButton href={bookOnlineHref} />}
        </BookingLinkCard>
      </BookingLinkShell>
    );
  }

  const label = (iso: string) => format(appointmentToCyprusDate(iso), LABEL, { locale: enUS });
  return (
    <BookingLinkShell>
      <ChooseProposalClient
        token={token}
        professionalName={ctx.professional.name}
        clinicLabel={[ctx.clinic.name, ctx.clinic.address].filter(Boolean).join(", ")}
        expiryLabel={label(ctx.link.expires_at)}
        slots={ctx.slots.map((iso) => ({ iso, label: label(iso) }))}
        bookOnlineHref={ctx.professional.slug ? publicProfessionalProfilePath(ctx.professional.slug) : null}
      />
    </BookingLinkShell>
  );
}
