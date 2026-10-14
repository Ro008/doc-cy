import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  ANNOUNCEMENT_FEATURES,
  buildProductAnnouncementEmailContent,
} from "../../lib/product-announcement-email";
import { HELP_LINKS, findHelpArticle } from "../../lib/help-manual";
import { escapeHtml } from "../../lib/resend";

const SITE = "https://www.mydoccy.com";
const build = (firstName?: string | null) => buildProductAnnouncementEmailContent({ siteUrl: SITE, firstName });

describe("buildProductAnnouncementEmailContent", () => {
  it("has a subject that says what is new", () => {
    const { subject } = build("Elena");
    assert.match(subject, /dashboard/i);
    assert.match(subject, /agenda/i);
    assert.match(subject, /settings/i);
  });

  it("greets her by first name, escaped, or plainly without one", () => {
    assert.match(build("Elena").html, /Hi Elena,/);
    assert.match(build("Elena").text, /^Hi Elena,/);
    assert.match(build(null).html, /Hi,/);
    assert.match(build("   ").text, /^Hi,/);
    const hostile = build('<img src=x onerror=alert(1)>').html;
    assert.ok(!hostile.includes("<img src=x"), "name is escaped");
    assert.match(hostile, /&lt;img src=x/);
  });

  it("covers the dashboard, the agenda and the settings, in that order, each with a title and points", () => {
    assert.deepEqual(
      ANNOUNCEMENT_FEATURES.map((f) => f.id),
      ["dashboard", "agenda", "settings"],
    );
    for (const feature of ANNOUNCEMENT_FEATURES) {
      assert.ok(feature.title.trim().length > 0);
      assert.ok(feature.points.length >= 3 && feature.points.length <= 5, `${feature.id}: ${feature.points.length} points`);
      assert.ok(feature.gif.alt.trim().length > 10, `${feature.id}: the alt text says what the animation shows`);
    }
    const { html } = build("Elena");
    const positions = ANNOUNCEMENT_FEATURES.map((f) => html.indexOf(f.title));
    assert.ok(positions.every((p) => p > -1), "every title is in the email");
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, "in order");
  });

  it("shows each animation from the site's own address, with its size and alt text, narrower than the card", () => {
    const { html } = build("Elena");
    for (const feature of ANNOUNCEMENT_FEATURES) {
      assert.ok(html.includes(`src="${SITE}/email/${feature.gif.file}"`), `${feature.id} gif src`);
      assert.ok(html.includes(`alt="${escapeHtml(feature.gif.alt)}"`), `${feature.id} gif alt`);
      assert.ok(feature.gif.width <= 516, `${feature.id} fits the card`);
    }
  });

  it("links to the dashboard and to the tutorials that explain each part", () => {
    const { html, text } = build("Elena");
    assert.ok(html.includes(`href="${SITE}/dashboard"`));
    for (const slug of Object.values(HELP_LINKS)) {
      assert.ok(findHelpArticle(slug), `${slug} is in the manual`);
      assert.ok(html.includes(`href="${SITE}/help#${slug}"`), `${slug} link in html`);
      assert.ok(text.includes(`${SITE}/help#${slug}`), `${slug} link in text`);
    }
  });

  it("invites her to write back and says how, in both versions", () => {
    const { html, text } = build("Elena");
    assert.match(html, /reply to this email/i);
    assert.match(text, /reply to this email/i);
  });

  it("has a hidden preheader and a plain-text version without markup", () => {
    const { html, text } = build("Elena");
    assert.match(html, /display:none[^>]*>[^<]*dashboard/i);
    assert.ok(!/<[a-z][\s\S]*>/i.test(text), "no tags in the text version");
  });

  it("loads nothing from anywhere but the site", () => {
    const { html } = build("Elena");
    const urls = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]);
    assert.ok(urls.length > 0);
    for (const url of urls) assert.ok(url.startsWith(SITE), `${url} is not the site's`);
  });
});

describe("the animations in public/email", () => {
  const MAX_BYTES = 1_300_000; // Gmail and phones load these on mobile data.
  for (const feature of ANNOUNCEMENT_FEATURES) {
    it(`${feature.gif.file} exists and stays under ${MAX_BYTES / 1_000_000} MB`, () => {
      const file = path.join(process.cwd(), "public", "email", feature.gif.file);
      assert.ok(fs.existsSync(file), `${file} is missing: record it with scripts/announcement-email`);
      assert.ok(fs.statSync(file).size <= MAX_BYTES, `${feature.gif.file} is ${fs.statSync(file).size} bytes`);
      assert.equal(fs.readFileSync(file).subarray(0, 3).toString("ascii"), "GIF");
    });
  }
});
