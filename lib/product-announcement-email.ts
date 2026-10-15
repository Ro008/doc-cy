import {
  EMAIL_HEADING,
  EMAIL_PRIMARY_BTN,
  EMAIL_SECTION_LABEL,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
  EMAIL_TEXT_LINK,
  EMAIL_TEXT_MUTED,
} from "@/lib/email-brand";
import { HELP_LINKS, helpArticlePath } from "@/lib/help-manual";
import { escapeHtml } from "@/lib/resend";

/**
 * "What's new" for professionals (user, 2026-10-14): the Dashboard, the redesigned Agenda and
 * Settings. One short animation per part, like the release notes of an editor, so she sees it
 * working instead of reading about it. Sent by hand to the active professionals (see
 * scripts/announcement-email/README.md), never from the app, so nothing here runs in a request.
 *
 * Everything in `points` is something shipped and checked in the product; keep it that way when
 * the copy changes.
 */

export type AnnouncementFeature = {
  id: "dashboard" | "agenda" | "settings";
  label: string;
  title: string;
  lead: string;
  points: readonly string[];
  /** In public/email, served at `${siteUrl}/email/${file}`. `width` is the size it is shown at. */
  gif: { file: string; alt: string; width: number };
  links: readonly { text: string; slug: string }[];
};

export const ANNOUNCEMENT_FEATURES: readonly AnnouncementFeature[] = [
  {
    id: "dashboard",
    label: "New",
    title: "A dashboard to run your day",
    lead: "DocCy now opens on your dashboard: everything that needs you, in one place.",
    points: [
      "Answer every booking request: accept it, decline it with a message, or suggest other times.",
      "See today's visits in order, with the next one highlighted.",
      "Add a booking made by phone or in person in a few taps.",
      "A reminder appears if your online bookings are paused.",
    ],
    gif: {
      file: "dashboard.gif",
      alt: "The new dashboard: a booking request is accepted and today's visits are listed in order.",
      width: 516,
    },
    links: [
      { text: "Take the 25-second tour", slug: HELP_LINKS.dashboardTour },
      { text: "Accept or decline a request", slug: HELP_LINKS.answerRequests },
      { text: "Suggest other times", slug: HELP_LINKS.suggestTimes },
    ],
  },
  {
    id: "agenda",
    label: "Redesigned",
    title: "An agenda that fits your week",
    lead: "Your agenda has a new look, and a new Visits tab keeps the ones you have already seen.",
    points: [
      "See the week or the whole month at a glance, with the month filling your screen.",
      "Holiday days are marked, so you know at once what is closed.",
      "Open any visit to see the patient's details.",
      "The Visits tab lists past visits, with filters, patient history and notes you can edit.",
    ],
    gif: {
      file: "agenda.gif",
      alt: "The redesigned agenda: the week, then the month, then a visit opened to see the patient's details.",
      width: 516,
    },
    links: [],
  },
  {
    id: "settings",
    label: "Redesigned",
    title: "Settings, organised around you",
    lead: "Everything you can change is easier to find, and most of it is edited right where you see it.",
    points: [
      "Your profile comes first; account details are set apart at the bottom.",
      "Your services are a price list you edit in place.",
      "Opening hours by the quarter hour, with a break for each day, clinic by clinic.",
      "Holiday mode, booking limits for each clinic, and your booking link ready to share.",
      "On a phone, every section is one tap away.",
    ],
    gif: {
      file: "settings.gif",
      alt: "The new settings: the sections, a service price edited in place, and opening hours picked by the quarter hour.",
      width: 516,
    },
    links: [],
  },
];

type EmailContent = { subject: string; text: string; html: string };

function greeting(firstName?: string | null): string {
  const name = firstName?.trim();
  return name ? `Hi ${name},` : "Hi,";
}

function featureHtml(feature: AnnouncementFeature, siteUrl: string): string {
  const gifUrl = `${siteUrl}/email/${feature.gif.file}`;
  const links = feature.links
    .map(
      (link) =>
        `<a href="${escapeHtml(siteUrl + helpArticlePath(link.slug))}" style="${EMAIL_TEXT_LINK}">${escapeHtml(link.text)}</a>`,
    )
    .join(`<span style="color:${EMAIL_TEXT_MUTED};"> &nbsp;·&nbsp; </span>`);
  return `
    <div style="margin:26px 0 0;padding-top:22px;border-top:1px solid rgba(176,190,201,.2);">
      <p style="${EMAIL_SECTION_LABEL}margin-top:0;color:#7DD9DF;">${escapeHtml(feature.label)}</p>
      <h2 style="margin:0 0 8px;font-size:21px;line-height:1.3;color:${EMAIL_HEADING};">${escapeHtml(feature.title)}</h2>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">${escapeHtml(feature.lead)}</p>
      <img src="${escapeHtml(gifUrl)}" alt="${escapeHtml(feature.gif.alt)}" width="${feature.gif.width}" style="display:block;width:100%;max-width:${feature.gif.width}px;height:auto;margin:0 0 14px;border:0;border-radius:10px;" />
      <ul style="margin:0 0 12px;padding:0 0 0 20px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
        ${feature.points.map((point) => `<li style="margin:0 0 6px;">${escapeHtml(point)}</li>`).join("\n        ")}
      </ul>
      ${links ? `<p style="margin:0;font-size:14px;line-height:1.6;">${links}</p>` : ""}
    </div>`;
}

export function buildProductAnnouncementEmailContent(opts: {
  siteUrl: string;
  firstName?: string | null;
}): EmailContent {
  const siteUrl = opts.siteUrl.replace(/\/+$/, "");
  const subject = "What's new in DocCy: your dashboard, agenda and settings";
  const preheader = "Everything in one place: a new dashboard, a better agenda and redesigned settings.";
  const dashboardUrl = `${siteUrl}/dashboard`;
  const hello = greeting(opts.firstName);
  const intro =
    "We have been busy. DocCy now opens on a dashboard where you can handle everything, and your agenda and settings have been redesigned.";
  const closing =
    "Short videos for each of these are in Help & tutorials, in your account menu. Questions, ideas, something that does not feel right? Reply to this email and we will read it.";

  const text =
    `${hello}\n\n${intro}\n\n` +
    ANNOUNCEMENT_FEATURES.map(
      (feature) =>
        `${feature.label.toUpperCase()}: ${feature.title}\n${feature.lead}\n` +
        feature.points.map((point) => `- ${point}`).join("\n") +
        (feature.links.length > 0
          ? `\n${feature.links.map((link) => `${link.text}: ${siteUrl}${helpArticlePath(link.slug)}`).join("\n")}`
          : ""),
    ).join("\n\n") +
    `\n\n${closing}\n\nOpen your dashboard: ${dashboardUrl}\n\nThe DocCy team\n\n---\nYou are receiving this because you have a DocCy professional account.`;

  const html = `
<span style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:transparent;">${escapeHtml(preheader)}</span>
${EMAIL_SHELL_OPEN}
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">${escapeHtml(hello)}</p>
    <h1 style="margin:0 0 10px;font-size:25px;line-height:1.25;color:${EMAIL_HEADING};">What's new in DocCy</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">${escapeHtml(intro)}</p>
    ${ANNOUNCEMENT_FEATURES.map((feature) => featureHtml(feature, siteUrl)).join("\n")}
    <div style="margin:26px 0 0;padding-top:22px;border-top:1px solid rgba(176,190,201,.2);">
      <a href="${escapeHtml(dashboardUrl)}" style="${EMAIL_PRIMARY_BTN}">Open your dashboard</a>
      <p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:${EMAIL_TEXT};">${escapeHtml(closing)}</p>
      <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:${EMAIL_TEXT};">The DocCy team</p>
      <p style="margin:22px 0 0;font-size:11px;line-height:1.55;color:#5C6F82;">You are receiving this because you have a DocCy professional account.</p>
    </div>
${EMAIL_SHELL_CLOSE}`;

  return { subject, text, html };
}
