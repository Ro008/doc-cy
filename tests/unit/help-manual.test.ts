import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  HELP_ARTICLES,
  HELP_MANUAL,
  HELP_PATH,
  findHelpArticle,
  helpArticlePath,
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

describe("findHelpArticle", () => {
  it("finds an article by slug and returns undefined for an unknown one", () => {
    assert.equal(findHelpArticle("dashboard")?.slug, "dashboard");
    assert.equal(findHelpArticle("nope"), undefined);
  });
});
