/**
 * The help manual (`/help`, behind the login): one short how-to video per task with the steps
 * written underneath, in the order a professional uses the product. The plan and the conventions
 * are in docs/help-manual.md.
 *
 * Every article's `slug` is an anchor (/help#dashboard) that people share, so it never changes once
 * published (tests/unit/help-manual.test.ts keeps the list of published ones).
 */

/** Where the manual lives. Login-gated like the rest of the professional's pages (lib/doctor-routes.ts). */
export const HELP_PATH = "/help";

export type HelpVideo = {
  /** Id of the video on DocCy's YouTube channel (the 11 characters after `youtu.be/`). */
  youtubeId: string;
  /** "0:25", shown on the player. */
  durationLabel: string;
  /** Thumbnail under /public/help: YouTube loads only after a click. */
  poster: string;
};

export type HelpArticle = {
  /** The anchor. Never rename once published. */
  slug: string;
  title: string;
  /** One line under the title. */
  summary: string;
  /** 3 to 6 short steps, imperative. */
  steps: readonly string[];
  video?: HelpVideo;
};

export type HelpSection = {
  /** Also an anchor. */
  id: string;
  title: string;
  articles: readonly HelpArticle[];
};

/** Sections in the order of a professional's journey; add an article when its video is published. */
export const HELP_MANUAL: readonly HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    articles: [
      {
        slug: "dashboard",
        title: "Your dashboard in 20 seconds",
        summary: "Booking requests, today's schedule and phone bookings, all in one place.",
        steps: [
          "Open Dashboard. Under \"Needs your answer\" you see every booking request, with the patient, the time and the reason for the visit.",
          "Press Accept to confirm a request. Your patient is notified.",
          "Look at Today on the right: your visits in order, with a marker for the current time and the next visit highlighted.",
          "Press Add manual booking for a patient who booked by phone or in person.",
          "If you paused online bookings, a reminder appears under the greeting, with a link to resume them in Settings.",
        ],
        video: {
          youtubeId: "4K0T_DNT3PY",
          durationLabel: "0:25",
          poster: "/help/dashboard-tour.jpg",
        },
      },
    ],
  },
];

export const HELP_ARTICLES: readonly HelpArticle[] = HELP_MANUAL.flatMap((section) => section.articles);

export function findHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
}

/** The page plus the article's anchor: the link to share a section as it is. */
export function helpArticlePath(slug: string): string {
  return `${HELP_PATH}#${slug}`;
}
