import {
  AUTOMATED_EMAIL_FOOTER_TEXT,
  automatedEmailFooterHtml,
  escapeHtml,
  sendResendEmail,
} from "@/lib/resend";
import {
  EMAIL_HEADING,
  EMAIL_PRIMARY_BTN,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
  EMAIL_TEXT_MUTED,
} from "@/lib/email-brand";
import { DOCTOR_FIRST_LOGIN_PATH } from "@/lib/first-login-trial-notice";
import type { ProfessionalRegistrationDetails } from "@/lib/professional-registration-request";
import { REGISTRATION_STATUS_PATH } from "@/lib/registration-status";
import { getDoctorLoginUrl } from "@/lib/site-url";

/**
 * The applicant is emailed every decision on their registration request: approved
 * (sign in, the public profile, the trial, and what the founders corrected) or not
 * approved (the reason, and how to apply again). Sent by the app after the decision
 * is saved; a failed email never undoes it.
 */

/** Test domains that no inbox receives (Resend would bounce them). */
const UNDELIVERABLE_TEST_SUFFIXES = ["@integration.test", "@test-doccy.com.cy"];

export function isUndeliverableTestEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return UNDELIVERABLE_TEST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

/** Plain-words lines for what the founders changed while approving. */
export function describeRegistrationCorrections(
  original: ProfessionalRegistrationDetails,
  approved: ProfessionalRegistrationDetails | null,
): string[] {
  if (!approved) return [];
  const lines: string[] = [];
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  if (original.first_name !== approved.first_name || original.last_name !== approved.last_name) {
    lines.push(`Name: ${approved.first_name} ${approved.last_name}`);
  }
  if (original.gender !== approved.gender) lines.push(`Gender: ${approved.gender}`);
  if (original.gesy !== approved.gesy) lines.push(`GeSY: ${approved.gesy ? "yes" : "no"}`);
  if (original.mobile !== approved.mobile) lines.push(`Mobile: ${approved.mobile}`);
  if (!same(original.languages, approved.languages)) lines.push(`Languages: ${approved.languages.join(", ")}`);
  if (!same(original.specialties, approved.specialties)) {
    lines.push(
      `Specialties: ${approved.specialties
        .map((s) => (s.license_number ? `${s.name} (licence ${s.license_number})` : s.name))
        .join(", ")}`,
    );
  }
  if (!same(original.clinics, approved.clinics)) {
    lines.push(
      `Clinics: ${approved.clinics.map((c) => `${c.name ?? "DocCy clinic"} (${c.address})`).join(", ")}`,
    );
  }
  if (original.photo && !approved.photo) lines.push("Photo: removed (you can add one from Settings)");
  else if (approved.photo && original.photo?.path !== approved.photo.path) lines.push("Photo: replaced by our team");
  if (!original.claimed_professional_id && approved.claimed_professional_id) {
    lines.push("Your existing DocCy listing was connected to your account");
  }
  return lines;
}

function cyprusDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Nicosia",
  }).format(new Date(iso));
}

export function buildRegistrationApprovedEmail(opts: {
  name: string;
  siteUrl: string;
  profilePath: string;
  accessUntil: string | null;
  corrections: string[];
}): { subject: string; text: string; html: string } {
  const base = opts.siteUrl.replace(/\/$/, "");
  const loginUrl = getDoctorLoginUrl(DOCTOR_FIRST_LOGIN_PATH, base);
  const profileUrl = `${base}${opts.profilePath}`;
  const trial = opts.accessUntil
    ? `Online bookings are free until ${cyprusDate(opts.accessUntil)}.`
    : null;

  const subject = "[DocCy] You're approved: your profile is live";
  const text = [
    `Hi ${firstName(opts.name)},`,
    "",
    "Your DocCy registration has been approved and your profile is live.",
    trial,
    "",
    `Sign in (with the email and password you registered with) to set your hours and turn on online bookings:\n${loginUrl}`,
    "",
    `Your public profile:\n${profileUrl}`,
    ...(opts.corrections.length
      ? ["", `While reviewing your application we changed:\n${opts.corrections.map((l) => `- ${l}`).join("\n")}`]
      : []),
    "",
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const p = (inner: string, color = EMAIL_TEXT) =>
    `<p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${color};">${inner}</p>`;
  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">You're approved</h2>
    ${p(`Hi ${escapeHtml(firstName(opts.name))},`)}
    ${p("Your DocCy registration has been approved and your profile is live.")}
    ${trial ? p(escapeHtml(trial)) : ""}
    <a href="${escapeHtml(loginUrl)}" style="${EMAIL_PRIMARY_BTN}">Sign in to DocCy</a>
    ${p(`Your public profile: <a href="${escapeHtml(profileUrl)}">${escapeHtml(profileUrl)}</a>`, EMAIL_TEXT_MUTED)}
    ${
      opts.corrections.length
        ? `${p("While reviewing your application we changed:")}<ul style="margin:0 0 10px;padding-left:20px;color:${EMAIL_TEXT};">${opts.corrections
            .map((line) => `<li>${escapeHtml(line)}</li>`)
            .join("")}</ul>`
        : ""
    }
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;
  return { subject, text, html };
}

export function buildRegistrationDeniedEmail(opts: {
  name: string;
  siteUrl: string;
  reason: string;
}): { subject: string; text: string; html: string } {
  const applyAgainUrl = getDoctorLoginUrl(REGISTRATION_STATUS_PATH, opts.siteUrl.replace(/\/$/, ""));
  const subject = "[DocCy] Your application was not approved";
  const text = [
    `Hi ${firstName(opts.name)},`,
    "",
    "We reviewed your DocCy registration and could not approve it.",
    "",
    `Reason: ${opts.reason}`,
    "",
    `You can apply again after fixing this. Sign in with the email and password you registered with, then choose "Apply again":\n${applyAgainUrl}`,
    "",
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`,
  ].join("\n");
  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">Your application was not approved</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">Hi ${escapeHtml(firstName(opts.name))},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">We reviewed your DocCy registration and could not approve it.</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};"><strong>Reason:</strong> ${escapeHtml(opts.reason)}</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">You can apply again after fixing this. Sign in with the email and password you registered with.</p>
    <a href="${escapeHtml(applyAgainUrl)}" style="${EMAIL_PRIMARY_BTN}">Apply again</a>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;
  return { subject, text, html };
}

/** Best-effort: logs and returns on failure. */
export async function sendRegistrationDecisionEmail(
  to: string,
  content: { subject: string; text: string; html: string },
): Promise<void> {
  const recipient = to.trim();
  if (!recipient || isUndeliverableTestEmail(recipient)) return;
  try {
    await sendResendEmail({ to: recipient, subject: content.subject, text: content.text, html: content.html });
  } catch (error) {
    console.error("[DocCy] registration decision email failed", error);
  }
}
