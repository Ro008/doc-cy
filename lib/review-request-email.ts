import { format } from "date-fns";
import { enUS } from "date-fns/locale";

import { appointmentToCyprusDate } from "@/lib/appointments";
import type { BuiltEmail } from "@/lib/booking-request-emails";
import {
  EMAIL_HEADING,
  EMAIL_PRIMARY_BTN,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
  EMAIL_TEXT_MUTED,
} from "@/lib/email-brand";
import { professionalFirstName } from "@/lib/professional-name";
import { REVIEW_LINK_DAYS } from "@/lib/professional-review";
import { AUTOMATED_EMAIL_FOOTER_TEXT, automatedEmailFooterHtml, escapeHtml } from "@/lib/resend";
import { reviewDisplayName } from "@/lib/review-display-name";

/** The review request the scheduled job sends 24 h after an attended visit (user, 2026-10-04). */
const P = `margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};`;
const MUTED = `margin:0;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};`;

export function buildPatientReviewRequestEmail(opts: {
  patientName: string;
  professionalName: string;
  appointmentIso: string;
  reviewUrl: string;
}): BuiltEmail {
  const date = format(appointmentToCyprusDate(opts.appointmentIso), "EEEE, d MMMM yyyy", { locale: enUS });
  const pro = professionalFirstName(opts.professionalName);
  const hi = String(opts.patientName ?? "").trim().split(/\s+/)[0] || "there";
  const shownAs = reviewDisplayName(opts.patientName);

  const subject = `How was your visit with ${pro}?`;
  const text =
    `Hi ${hi},\n\n` +
    `How was your visit with ${pro} on ${date}? Your review helps other patients choose.\n\n` +
    `Write a review:\n${opts.reviewUrl}\n\n` +
    `Your review will appear as "${shownAs}" with your rating and the date. Your email is never shown.\n` +
    `This link works once, for ${REVIEW_LINK_DAYS} days.\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;
  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">How was your visit?</h2>
    <p style="${P}">Hi ${escapeHtml(hi)},</p>
    <p style="${P}">
      How was your visit with <strong>${escapeHtml(pro)}</strong> on <strong>${escapeHtml(date)}</strong>?
      Your review helps other patients choose.
    </p>
    <a href="${escapeHtml(opts.reviewUrl)}" style="${EMAIL_PRIMARY_BTN}">Write a review</a>
    <p style="${P}">Your review will appear as <strong>${escapeHtml(shownAs)}</strong> with your rating and the date. Your email is never shown.</p>
    <p style="${MUTED}">This link works once, for ${REVIEW_LINK_DAYS} days. If the button does not work, copy this link: ${escapeHtml(opts.reviewUrl)}</p>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;
  return { subject, text, html };
}
