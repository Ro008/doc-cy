import {
  EMAIL_HEADING,
  EMAIL_PRIMARY_BTN,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
} from "@/lib/email-brand";
import type { ProfileChangeKind } from "@/lib/profile-change-requests";
import { AUTOMATED_EMAIL_FOOTER_TEXT, automatedEmailFooterHtml, escapeHtml } from "@/lib/resend";

/**
 * Emails of the name and photo change requests (user, 2026-10-10): the founders are
 * told when one enters the queue; she is emailed every decision.
 */

const KIND_SUBJECT: Record<ProfileChangeKind, string> = { name: "name change", photo: "new photo" };

/** The founders' notice that a request entered the queue. */
export function buildProfileChangeNotifyContent(input: {
  kind: ProfileChangeKind;
  professionalName: string;
  requestedName?: string | null;
  reason?: string | null;
  siteUrl: string;
}): { subject: string; text: string } {
  const base = input.siteUrl.replace(/\/$/, "");
  const review = `Review: ${base}/internal/directory?tab=requests`;
  if (input.kind === "photo") {
    return {
      subject: `[PHOTO CHANGE] ${input.professionalName}`,
      text: [`${input.professionalName} asked for a new profile photo.`, "", review].join("\n"),
    };
  }
  return {
    subject: `[NAME CHANGE] ${input.professionalName} → ${input.requestedName ?? ""}`,
    text: [
      `${input.professionalName} asked to change the name on their profile.`,
      "",
      `Current name: ${input.professionalName}`,
      `Requested name: ${input.requestedName ?? ""}`,
      `Reason: ${input.reason?.trim() || "none given"}`,
      "",
      review,
    ].join("\n"),
  };
}

type DecisionEmail = { subject: string; text: string; html: string };

const paragraph = (text: string) =>
  `<p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">${text}</p>`;

function decisionHtml(heading: string, paragraphs: string[], button: { href: string; label: string }): string {
  return `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">${escapeHtml(heading)}</h2>
    ${paragraphs.map(paragraph).join("\n    ")}
    <a href="${escapeHtml(button.href)}" style="${EMAIL_PRIMARY_BTN}">${escapeHtml(button.label)}</a>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;
}

export function buildProfileChangeApprovedEmail(opts: {
  kind: ProfileChangeKind;
  firstName: string;
  siteUrl: string;
  profilePath: string;
  approvedName?: string;
  requestedName?: string;
  addressChanged?: boolean;
}): DecisionEmail {
  const profileUrl = `${opts.siteUrl.replace(/\/$/, "")}${opts.profilePath}`;
  const greeting = `Hi ${opts.firstName},`;
  if (opts.kind === "photo") {
    const line = "Your new photo is now on your profile.";
    return {
      subject: "[DocCy] Your new photo is approved",
      text: [greeting, "", line, "", `Your public profile:\n${profileUrl}`, "", `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`].join("\n"),
      html: decisionHtml("Your new photo is approved", [escapeHtml(greeting), escapeHtml(line)], {
        href: profileUrl,
        label: "See your profile",
      }),
    };
  }
  const approved = opts.approvedName ?? "";
  const lines = [`Your DocCy profile now shows the name ${approved}.`];
  if (opts.requestedName && opts.requestedName !== approved) {
    lines.push(`We adjusted the spelling you sent (${opts.requestedName}).`);
  }
  if (opts.addressChanged) {
    lines.push("Your profile has a new address, below. The old address still works: it forwards to the new one.");
  }
  return {
    subject: "[DocCy] Your name change is approved",
    text: [greeting, "", ...lines, "", `Your public profile:\n${profileUrl}`, "", `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`].join("\n"),
    html: decisionHtml("Your name change is approved", [escapeHtml(greeting), ...lines.map(escapeHtml)], {
      href: profileUrl,
      label: "See your profile",
    }),
  };
}

export function buildProfileChangeDeniedEmail(opts: {
  kind: ProfileChangeKind;
  firstName: string;
  siteUrl: string;
  reason: string;
}): DecisionEmail {
  const settingsUrl = `${opts.siteUrl.replace(/\/$/, "")}/settings?section=profile`;
  const what = KIND_SUBJECT[opts.kind];
  const heading = `Your ${what} was not approved`;
  const greeting = `Hi ${opts.firstName},`;
  const intro = `We reviewed your ${what} and could not approve it. Your profile is unchanged.`;
  const again = "You can send a new request from Settings.";
  return {
    subject: `[DocCy] ${heading}`,
    text: [
      greeting,
      "",
      intro,
      "",
      `Reason: ${opts.reason}`,
      "",
      `${again}\n${settingsUrl}`,
      "",
      `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`,
    ].join("\n"),
    html: decisionHtml(
      heading,
      [escapeHtml(greeting), escapeHtml(intro), `<strong>Reason:</strong> ${escapeHtml(opts.reason)}`, escapeHtml(again)],
      { href: settingsUrl, label: "Open Settings" },
    ),
  };
}
