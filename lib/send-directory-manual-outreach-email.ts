import { sendResendEmail } from "@/lib/resend";
import {
  buildDirectoryManualOutreachEmail,
  getDirectoryOutreachFrom,
} from "@/lib/directory-manual-outreach";

export async function sendDirectoryManualOutreachEmail(opts: {
  to: string;
  siteUrl: string;
  professionalName: string;
  slug: string;
  bookingCount: number;
  phoneClickCount: number;
  replyTo: string;
}): Promise<void> {
  const content = buildDirectoryManualOutreachEmail({
    siteUrl: opts.siteUrl,
    professionalName: opts.professionalName,
    slug: opts.slug,
    bookingCount: opts.bookingCount,
    phoneClickCount: opts.phoneClickCount,
  });

  await sendResendEmail({
    from: getDirectoryOutreachFrom(),
    to: opts.to,
    replyTo: opts.replyTo,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}
