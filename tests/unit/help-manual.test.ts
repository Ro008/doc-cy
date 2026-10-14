import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  HELP_ARTICLES,
  HELP_LINKS,
  HELP_MANUAL,
  HELP_PATH,
  HELP_TOUR_DISMISSED_KEY,
  filterHelpManual,
  findHelpArticle,
  helpArticlePath,
  nextHelpArticle,
} from "../../lib/help-manual";
import { isYouTubeVideoId } from "../../lib/youtube-embed";

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Anchors that have been published: /help#<slug> may already be in someone's chat or email.
 * Never remove or rename one here; only append when an article is published.
 */
const PUBLISHED_SLUGS = ["dashboard", "accept-or-decline", "suggest-other-times"];

describe("HELP_PATH", () => {
  it("is the manual's page", () => {
    assert.equal(HELP_PATH, "/help");
  });
});

describe("helpArticlePath", () => {
  it("is the page plus the article's anchor, so a section can be shared as it is", () => {
    assert.equal(helpArticlePath("dashboard"), "/help#dashboard");
  });
});

describe("HELP_MANUAL", () => {
  it("has at least one section, each with at least one article", () => {
    assert.ok(HELP_MANUAL.length > 0);
    for (const section of HELP_MANUAL) {
      assert.ok(section.articles.length > 0, `${section.id} has no articles`);
    }
  });

  it("has unique kebab-case ids for sections and articles, in one namespace (they are all anchors)", () => {
    const ids = [...HELP_MANUAL.map((s) => s.id), ...HELP_ARTICLES.map((a) => a.slug)];
    assert.equal(new Set(ids).size, ids.length, "an id is used twice");
    for (const id of ids) assert.match(id, KEBAB, id);
  });

  it("keeps every published anchor", () => {
    const slugs = HELP_ARTICLES.map((a) => a.slug);
    for (const published of PUBLISHED_SLUGS) {
      assert.ok(slugs.includes(published), `the anchor #${published} was removed or renamed`);
    }
  });

  for (const article of HELP_ARTICLES) {
    describe(article.slug, () => {
      it("has a title, a one-line summary and between 3 and 6 written steps", () => {
        assert.ok(article.title.trim().length > 0);
        assert.ok(article.summary.trim().length > 0);
        assert.ok(article.steps.length >= 3 && article.steps.length <= 6, `${article.steps.length} steps`);
        for (const step of article.steps) assert.ok(step.trim().length > 0);
      });

      if (article.video) {
        const video = article.video;
        it("has a valid YouTube id, a duration and a poster that exists in /public", () => {
          assert.equal(isYouTubeVideoId(video.youtubeId), true);
          assert.match(video.durationLabel, /^\d:\d\d$/);
          assert.ok(video.poster.startsWith("/help/"));
          assert.ok(fs.existsSync(path.join(process.cwd(), "public", video.poster)), video.poster);
        });
      }
    });
  }
});

describe("HELP_LINKS (where the product points into the manual)", () => {
  it("every link goes to a published article that has a video", () => {
    for (const [where, slug] of Object.entries(HELP_LINKS)) {
      const article = findHelpArticle(slug);
      assert.ok(article, `${where} points at #${slug}, which is not in the manual`);
      assert.ok(article.video, `${where} points at #${slug}, which has no video`);
      assert.ok(PUBLISHED_SLUGS.includes(slug), `${where}: #${slug} is not in PUBLISHED_SLUGS`);
    }
  });

  it("the dashboard tour card remembers it was closed under its own key", () => {
    assert.match(HELP_TOUR_DISMISSED_KEY, /^doccy:dashboard:/);
  });
});

describe("filterHelpManual", () => {
  const articleCount = (sections: typeof HELP_MANUAL) => sections.reduce((n, s) => n + s.articles.length, 0);

  it("returns everything for an empty or blank search", () => {
    assert.equal(articleCount(filterHelpManual(HELP_MANUAL, "")), HELP_ARTICLES.length);
    assert.equal(articleCount(filterHelpManual(HELP_MANUAL, "   ")), HELP_ARTICLES.length);
  });

  it("matches the title, the summary and the steps, ignoring case", () => {
    const byTitle = filterHelpManual(HELP_MANUAL, "DECLINE");
    assert.ok(byTitle.flatMap((s) => s.articles).some((a) => a.slug === "accept-or-decline"));
    const bySummary = filterHelpManual(HELP_MANUAL, "free times");
    assert.ok(bySummary.flatMap((s) => s.articles).every((a) => a.slug !== "dashboard"));
    const byStep = filterHelpManual(HELP_MANUAL, "marker for the current time");
    assert.deepEqual(byStep.flatMap((s) => s.articles).map((a) => a.slug), ["dashboard"]);
  });

  it("needs every word of the search, in any order", () => {
    const hit = filterHelpManual(HELP_MANUAL, "patient decline");
    assert.ok(hit.flatMap((s) => s.articles).some((a) => a.slug === "accept-or-decline"));
    assert.equal(articleCount(filterHelpManual(HELP_MANUAL, "decline zzzzzz")), 0);
  });

  it("drops sections with no match and keeps the order of the rest", () => {
    const hit = filterHelpManual(HELP_MANUAL, "suggest");
    assert.deepEqual(hit.map((s) => s.id), ["requests"]);
    assert.deepEqual(filterHelpManual(HELP_MANUAL, "zzzzzz"), []);
  });
});

describe("nextHelpArticle", () => {
  it("is the article after this one, in the manual's order, and none after the last", () => {
    assert.equal(nextHelpArticle(HELP_ARTICLES[0].slug)?.slug, HELP_ARTICLES[1].slug);
    assert.equal(nextHelpArticle(HELP_ARTICLES[HELP_ARTICLES.length - 1].slug), undefined);
    assert.equal(nextHelpArticle("nope"), undefined);
  });
});

describe("findHelpArticle", () => {
  it("finds an article by slug and returns undefined for an unknown one", () => {
    assert.equal(findHelpArticle("dashboard")?.slug, "dashboard");
    assert.equal(findHelpArticle("nope"), undefined);
  });
});
