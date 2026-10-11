import {
  EMAIL_HEADING,
  EMAIL_PRIMARY_BTN,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
} from "@/lib/email-brand";
import type { ClinicChangeLine } from "@/lib/clinic-requests";
import { AUTOMATED_EMAIL_FOOTER_TEXT, automatedEmailFooterHtml, escapeHtml } from "@/lib/resend";

/**
 * Emails of the clinic requests (user, 2026-10-11): the founders are told when one
 * enters the queue; she is emailed every decision.
 */

type DecisionEmail = { subject: string; text: string; html: string };

const settingsUrl = (siteUrl: string) => `${siteUrl.replace(/\/$/, "")}/settings?section=clinics`;
const reviewLine = (siteUrl: string) => `Review: ${siteUrl.replace(/\/$/, "")}/internal/directory?tab=requests`;

/** The founders' notice that she asked for a clinic DocCy does not have. */
export function buildClinicAddNotifyContent(input: {
  professionalName: string;
  clinic: { name: string; address: string; phone: string };
  siteUrl: string;
}): { subject: string; text: string } {
  return {
    subject: `[NEW CLINIC] ${input.professionalName}: ${input.clinic.name}`,
    text: [
      `${input.professionalName} asked to add a clinic DocCy does not have yet.`,
      "",
      `Name: ${input.clinic.name}`,
      `Address: ${input.clinic.address}`,
      `Phone: ${input.clinic.phone}`,
      "",
      reviewLine(input.siteUrl),
    ].join("\n"),
  };
}

/** The founders' notice that she asked to change a clinic's details. */
export function buildClinicDetailsNotifyContent(input: {
  professionalName: string;
  clinicName: string;
  lines: ClinicChangeLine[];
  /** Professionals who work at the clinic, her included. */
  professionalCount: number;
  siteUrl: string;
}): { subject: string; text: string } {
  const others = input.professionalCount - 1;
  return {
    subject: `[CLINIC CHANGE] ${input.professionalName}: ${input.clinicName}`,
    text: [
      `${input.professionalName} asked to change the details of ${input.clinicName}.`,
      others > 0
        ? `${others} other professional${others === 1 ? "" : "s"} work${others === 1 ? "s" : ""} at this clinic: the change applies for all of them.`
        : "Nobody else works at this clinic.",
      "",
      ...input.lines.map((line) => `${line.label}: ${line.from} → ${line.to}`),
      "",
      reviewLine(input.siteUrl),
    ].join("\n"),
  };
}

const paragraph = (text: string) =>
  `<p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">${text}</p>`;

function decision(opts: {
  subject: string;
  heading: string;
  firstName: string;
  lines: string[];
  /** Lines shown as they are in the HTML (already escaped). */
  htmlLines?: string[];
  siteUrl: string;
}): DecisionEmail {
  const url = settingsUrl(opts.siteUrl);
  const greeting = `Hi ${opts.firstName},`;
  return {
    subject: opts.subject,
    text: [greeting, "", ...opts.lines, "", `Your clinics:\n${url}`, "", `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`].join("\n"),
    html: `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">${escapeHtml(opts.heading)}</h2>
    ${[escapeHtml(greeting), ...(opts.htmlLines ?? opts.lines.map(escapeHtml))].map(paragraph).join("\n    ")}
    <a href="${escapeHtml(url)}" style="${EMAIL_PRIMARY_BTN}">Open your clinics</a>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`,
  };
}

/** Her new clinic was approved: created, or she was joined to a clinic DocCy already had. */
export function buildClinicAddApprovedEmail(opts: {
  firstName: string;
  clinicName: string;
  /** False when DocCy already had the clinic and she was joined to it. */
  created: boolean;
  siteUrl: string;
}): DecisionEmail {
  const heading = `${opts.clinicName} is now on your profile`;
  return decision({
    subject: `[DocCy] ${heading}`,
    heading,
    firstName: opts.firstName,
    lines: [
      opts.created
        ? `We approved your request and added ${opts.clinicName} to DocCy.`
        : `DocCy already had this clinic, as ${opts.clinicName}: we added it to your profile.`,
      "Online booking is off there for now. Check your hours in Settings, then switch it on.",
    ],
    siteUrl: opts.siteUrl,
  });
}

/** The details she asked to change were changed (as asked, or as the founders corrected them). */
export function buildClinicDetailsApprovedEmail(opts: {
  firstName: string;
  clinicName: string;
  lines: ClinicChangeLine[];
  corrected: boolean;
  siteUrl: string;
}): DecisionEmail {
  const heading = `The details of ${opts.clinicName} were updated`;
  const intro = opts.corrected
    ? "We approved your request, with a small correction. The clinic now shows:"
    : "We approved your request. The clinic now shows:";
  const shown = opts.lines.map((line) => `${line.label}: ${line.to}`);
  return decision({
    subject: `[DocCy] ${heading}`,
    heading,
    firstName: opts.firstName,
    lines: [intro, ...shown],
    htmlLines: [
      escapeHtml(intro),
      opts.lines.map((line) => `<strong>${escapeHtml(line.label)}:</strong> ${escapeHtml(line.to)}`).join("<br />"),
    ],
    siteUrl: opts.siteUrl,
  });
}

export function buildClinicRequestDeniedEmail(opts: {
  kind: "add" | "details";
  firstName: string;
  clinicName: string;
  reason: string;
  siteUrl: string;
}): DecisionEmail {
  const what =
    opts.kind === "add" ? `request to add ${opts.clinicName}` : `request to change the details of ${opts.clinicName}`;
  const heading = `Your ${what} was not approved`;
  const intro = `We reviewed your ${what} and could not approve it. Nothing was changed.`;
  const again = "You can send a new request from Settings.";
  return decision({
    subject: `[DocCy] ${heading}`,
    heading,
    firstName: opts.firstName,
    lines: [intro, `Reason: ${opts.reason}`, again],
    htmlLines: [escapeHtml(intro), `<strong>Reason:</strong> ${escapeHtml(opts.reason)}`, escapeHtml(again)],
    siteUrl: opts.siteUrl,
  });
}
