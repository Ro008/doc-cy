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

/**
 * Where the product points into the manual (the Dashboard's tour card and its "How does this work?"
 * links). A test checks every slug here is a published article with a video, so renaming or removing
 * one cannot leave a dead link behind.
 */
export const HELP_LINKS = {
  dashboardTour: "dashboard",
  answerRequests: "accept-or-decline",
  suggestTimes: "suggest-other-times",
} as const;

/** The tour card on the Dashboard stays closed on this device once she closes it (see useDeviceDismissals). */
export const HELP_TOUR_DISMISSED_KEY = "doccy:dashboard:help-tour-dismissed";

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
  {
    id: "requests",
    title: "Booking requests",
    articles: [
      {
        slug: "accept-or-decline",
        title: "Accept or decline a booking request",
        summary: "Answer in one tap, and see what your patient gets by email.",
        steps: [
          "Open Dashboard. Every request waiting for you is under \"Needs your answer\".",
          "Press Accept to confirm it. The visit goes to your agenda and your patient gets a confirmation email.",
          "Press Decline if you cannot take it. Write a short message saying why.",
          "Press Decline & notify. Your patient gets your message by email, with a link to book another time.",
        ],
        video: {
          youtubeId: "mulwC9xfQzg",
          durationLabel: "0:35",
          poster: "/help/accept-or-decline.jpg",
        },
      },
      {
        slug: "suggest-other-times",
        title: "Suggest other times for a booking request",
        summary: "When the time asked for does not work, offer other times in one step.",
        steps: [
          "Open Dashboard and find the request under \"Needs your answer\".",
          "Press Suggest other times. Your next free times are already picked for you.",
          "Press Send proposal to patient. Your patient gets an email to choose one of the times.",
          "They have 24 hours to choose. You do not have to do anything else.",
        ],
        video: {
          youtubeId: "BesF1rwIc8Y",
          durationLabel: "0:26",
          poster: "/help/suggest-other-times.jpg",
        },
      },
    ],
  },
];

export const HELP_ARTICLES: readonly HelpArticle[] = HELP_MANUAL.flatMap((section) => section.articles);

export function findHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
}

/**
 * The manual narrowed to what a search matches: every word has to appear in the article's title,
 * summary or steps (any order, any case). Sections left empty are dropped; the order is kept.
 */
export function filterHelpManual(sections: readonly HelpSection[], query: string): readonly HelpSection[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return sections;
  return sections
    .map((section) => ({
      ...section,
      articles: section.articles.filter((article) => {
        const text = [article.title, article.summary, ...article.steps].join(" ").toLowerCase();
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((section) => section.articles.length > 0);
}

/** The article after this one in the manual, to keep the reader going. */
export function nextHelpArticle(slug: string): HelpArticle | undefined {
  const index = HELP_ARTICLES.findIndex((article) => article.slug === slug);
  return index === -1 ? undefined : HELP_ARTICLES[index + 1];
}

/** The page plus the article's anchor: the link to share a section as it is. */
export function helpArticlePath(slug: string): string {
  return `${HELP_PATH}#${slug}`;
}
