import { BookingLinkCard, BookingLinkShell, BookingLinkText } from "@/components/booking/BookingLinkPanels";
import { ConfirmEmailChangeClient } from "@/components/auth/ConfirmEmailChangeClient";
import { confirmEmailChangeOutcome } from "@/lib/account-email-change";
import { findWaitingEmailChange } from "@/lib/account-email-change-server";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Confirm your new email | DocCy", robots: { index: false, follow: false } };

/**
 * The page the "Confirm your new email" email opens (user, 2026-10-11). Opening it
 * changes nothing; the button does (email scanners open links).
 */
export default async function ConfirmEmailChangePage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token?.trim() ?? "";
  const service = createServiceRoleClient();
  const waiting = service ? await findWaitingEmailChange(service, token).catch(() => null) : null;

  if (!waiting) {
    const gone = confirmEmailChangeOutcome(410, null);
    return (
      <BookingLinkShell>
        <BookingLinkCard title={gone.title} testId="confirm-email-gone">
          <BookingLinkText>{gone.message}</BookingLinkText>
        </BookingLinkCard>
      </BookingLinkShell>
    );
  }

  return (
    <BookingLinkShell>
      <ConfirmEmailChangeClient token={token} newEmail={waiting.newEmail} />
    </BookingLinkShell>
  );
}
