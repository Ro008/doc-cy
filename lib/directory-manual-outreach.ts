import { escapeHtml } from "@/lib/resend";
import { EMAIL_FONT, EMAIL_PRIMARY_BTN } from "@/lib/email-brand";
import { FOR_PROFESSIONALS_PATH } from "@/lib/finder-public-path";
import { manualDirectoryLandingPath } from "@/lib/manual-directory-landing-path";
import { professionalFirstName } from "@/lib/professional-name";

export const OUTREACH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const OUTREACH_COOLDOWN_MS = 21 * 24 * 60 * 60 * 1000;
export const OUTREACH_MIN_BOOKING_COUNT = 3;
export const OUTREACH_MIN_TOTAL_COUNT = 5;
/** Stay well under Resend free 100 emails/day (booking mail still needs headroom). */
export const OUTREACH_MAX_SENDS_PER_RUN = 25;

/**
 * Display name + address Resend sends from. The local-part `hello@` is sending-only
 * (verified mydoccy.com domain). Replies go to getDirectoryOutreachReplyTo().
 */
export const DIRECTORY_OUTREACH_FROM_DEFAULT = "Roxy from DocCy <hello@mydoccy.com>";
export const DIRECTORY_OUTREACH_REPLY_TO_DEFAULT = "Roxy <doccyteam@gmail.com>";

export function getDirectoryOutreachFrom(): string {
  const trimmed = process.env.RESEND_OUTREACH_FROM?.trim();
  return trimmed || DIRECTORY_OUTREACH_FROM_DEFAULT;
}

export function getDirectoryOutreachReplyTo(): string {
  const dedicated = process.env.RESEND_OUTREACH_REPLY_TO?.trim();
  if (dedicated) return dedicated;
  return DIRECTORY_OUTREACH_REPLY_TO_DEFAULT;
}

/**
 * Live send gate. Cron can run without this; it will not email professionals.
 *
 * Turn on only after: code is on Vercel Production AND the outreach migration
 * is on the prod database. Then set in Vercel → Production:
 *   DIRECTORY_MANUAL_OUTREACH_ENABLED=1
 * and redeploy. Do not set this on Preview.
 */
export function isDirectoryManualOutreachEnabled(): boolean {
  const raw = (process.env.DIRECTORY_MANUAL_OUTREACH_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function shouldSendDirectoryOutreach(input: {
  bookingCount: number;
  phoneClickCount: number;
}): boolean {
  const bookings = Math.max(0, input.bookingCount);
  const phones = Math.max(0, input.phoneClickCount);
  if (bookings >= OUTREACH_MIN_BOOKING_COUNT) return true;
  return bookings + phones >= OUTREACH_MIN_TOTAL_COUNT;
}

export type OutreachCountRow = {
  manualId: string;
  bookingCount: number;
  phoneClickCount: number;
};

export function mergeOutreachCounts(
  bookingCounts: Map<string, number>,
  phoneCounts: Map<string, number>,
): OutreachCountRow[] {
  const ids = new Set<string>([...bookingCounts.keys(), ...phoneCounts.keys()]);
  const rows: OutreachCountRow[] = [];
  for (const manualId of ids) {
    rows.push({
      manualId,
      bookingCount: bookingCounts.get(manualId) ?? 0,
      phoneClickCount: phoneCounts.get(manualId) ?? 0,
    });
  }
  return rows;
}

export function countByManualId(rows: { manual_id?: string | null }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const id = String(row.manual_id ?? "").trim();
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

export function sortOutreachCandidates<T extends OutreachCountRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (b.bookingCount !== a.bookingCount) return b.bookingCount - a.bookingCount;
    const totalA = a.bookingCount + a.phoneClickCount;
    const totalB = b.bookingCount + b.phoneClickCount;
    if (totalB !== totalA) return totalB - totalA;
    return a.manualId.localeCompare(b.manualId);
  });
}

export function directoryManualProfileUrl(siteUrl: string, slug: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}${manualDirectoryLandingPath(slug)}`;
}

export function directoryManualForProfessionalsUrl(siteUrl: string): string {
  return `${siteUrl.replace(/\/$/, "")}${FOR_PROFESSIONALS_PATH}`;
}

export function directoryManualUnsubscribeUrl(input: {
  siteUrl: string;
  manualId: string;
  token: string;
}): string {
  const url = new URL("/unsubscribe", `${input.siteUrl.replace(/\/$/, "")}/`);
  url.searchParams.set("id", input.manualId);
  url.searchParams.set("token", input.token);
  return url.toString();
}

function patientsPhrase(count: number): string {
  return count === 1 ? "1 patient" : `${count} patients`;
}

const OUTREACH_TEXT = "#1e293b";
const OUTREACH_MUTED = "#64748b";
const OUTREACH_LINK = "color:#0f766e;font-weight:600;text-decoration:underline;";

export type DirectoryManualOutreachEmailContent = {
  subject: string;
  text: string;
  html: string;
  profileUrl: string;
  forProfessionalsUrl: string;
};

export function buildDirectoryManualOutreachEmail(opts: {
  siteUrl: string;
  professionalName: string;
  slug: string;
  bookingCount: number;
  phoneClickCount: number;
}): DirectoryManualOutreachEmailContent {
  const firstName = professionalFirstName(opts.professionalName);
  const bookings = Math.max(0, opts.bookingCount);
  const phones = Math.max(0, opts.phoneClickCount);
  const intentCount = bookings + phones;
  const profileUrl = directoryManualProfileUrl(opts.siteUrl, opts.slug);
  const forProfessionalsUrl = directoryManualForProfessionalsUrl(opts.siteUrl);
  const intentLabel = patientsPhrase(intentCount);

  const subject = `${firstName}, last week ${intentLabel} tried to book with you on DocCy`;

  const lead =
    `${intentLabel} tried to book an appointment with you on DocCy last week, but couldn't — online booking isn't switched on yet.`;
  const phoneLine =
    "We showed them your direct phone number. But the reality is simple: most people never call. They just book with the next available doctor.";
  const valueLine =
    "Automated booking catches patients outside office hours and cuts phone interruptions during your consultations.";
  const offerLine =
    "I'll be direct: I want you to use DocCy. We're not a charity. But I'm convinced you gain far more from this than we do — and that's why we're offering it to you free for a trial period.";
  const coffeeLine =
    "If you'd like a hand setting it up, my team and I are happy to meet in person over coffee if you are in Paphos or nearby. Just reply with a day that works.";

  const text = [
    `Hi ${firstName},`,
    "",
    lead,
    "",
    phoneLine,
    "",
    valueLine,
    "",
    offerLine,
    "",
    "Your profile:",
    profileUrl,
    "",
    `Activate online booking (Free, a few minutes):`,
    forProfessionalsUrl,
    "",
    coffeeLine,
    "",
    "Best,",
    "Roxy",
    "Founder",
  ].join("\n");

  const html = `
<div style="margin:0;padding:20px 12px;background:#f4f6f8;font-family:${EMAIL_FONT};">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px 22px;color:${OUTREACH_TEXT};">
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${OUTREACH_TEXT};">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${OUTREACH_TEXT};">
      <strong>${escapeHtml(intentLabel)}</strong> tried to book an appointment with you on DocCy last week, but couldn't — online booking isn't switched on yet.
    </p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${OUTREACH_TEXT};">${escapeHtml(phoneLine)}</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${OUTREACH_TEXT};">${escapeHtml(valueLine)}</p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:${OUTREACH_TEXT};">${escapeHtml(offerLine)}</p>
    <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:${OUTREACH_MUTED};">Your profile</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55;word-break:break-word;">
      <a href="${escapeHtml(profileUrl)}" style="${OUTREACH_LINK}">See your profile on DocCy</a>
    </p>
    <a href="${escapeHtml(forProfessionalsUrl)}" style="${EMAIL_PRIMARY_BTN}">Activate online booking (Free, a few minutes)</a>
    <p style="margin:16px 0 0;font-size:16px;line-height:1.6;color:${OUTREACH_TEXT};">${escapeHtml(coffeeLine)}</p>
    <p style="margin:24px 0 0;font-size:16px;line-height:1.6;color:${OUTREACH_TEXT};">
      Best,<br/><strong>Roxy</strong><br/>
      <span style="color:${OUTREACH_MUTED};">Founder</span>
    </p>
  </div>
</div>`;

  return { subject, text, html, profileUrl, forProfessionalsUrl };
}
