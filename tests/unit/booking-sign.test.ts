import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBookingSignHtml } from "../../lib/booking-sign";
import { resolvePromotePracticeCopy } from "../../lib/promote-practice-copy";

/**
 * The printed booking sign, design A "Clean & calm" (user, 2026-10-01): the DocCy logo,
 * a "Book online · 24/7" badge, one headline, the name and specialty as on the
 * profile (no "Dr" added: not every professional is a doctor), the QR, three steps
 * and the short link, on one A5 page.
 */

const base = {
  doctorName: "Harrison Ford",
  specialty: "Accident & Emergency Medicine",
  qrDataUrl: "data:image/png;base64,QR",
  logoUrl: "https://www.mydoccy.com/brand/doccy-logo.png",
  shortLink: "mydoccy.com/harrison-ford",
  copy: resolvePromotePracticeCopy("en"),
};

describe("buildBookingSignHtml", () => {
  it("prints one A5 page", () => {
    assert.match(buildBookingSignHtml(base), /@page \{ size: A5 portrait; margin: 0; \}/);
  });

  it("carries the logo, badge, headline, QR, steps and short link", () => {
    const html = buildBookingSignHtml(base);
    assert.match(html, /<img class="logo" src="https:\/\/www\.mydoccy\.com\/brand\/doccy-logo\.png" alt="my doccy"/);
    assert.match(html, /Book online · 24\/7/);
    assert.match(html, /<h1>Book your next visit online<\/h1>/);
    assert.match(html, /<img class="qr" src="data:image\/png;base64,QR"/);
    for (const step of ["Scan the code", "Pick a time", "Get a confirmation"]) {
      assert.ok(html.includes(step), step);
    }
    assert.match(html, /mydoccy\.com\/harrison-ford/);
    assert.match(html, /No app needed/);
  });

  it("shows the name and specialty as on the profile, never adding Dr", () => {
    const html = buildBookingSignHtml(base);
    assert.ok(html.includes("Harrison Ford · Accident &amp; Emergency Medicine"));
    assert.ok(!/\bDr\.? Harrison/.test(html));
  });

  it("shows only the name when there is no approved specialty", () => {
    const html = buildBookingSignHtml({ ...base, specialty: "  " });
    assert.match(html, /<p class="who">Harrison Ford<\/p>/);
  });

  it("escapes what comes from the profile", () => {
    const html = buildBookingSignHtml({ ...base, doctorName: `<script>"x"</script>` });
    assert.ok(!html.includes("<script>\"x\""));
    assert.ok(html.includes("&lt;script&gt;&quot;x&quot;&lt;/script&gt;"));
  });

  it("is written in Greek for a Greek profile", () => {
    const html = buildBookingSignHtml({ ...base, copy: resolvePromotePracticeCopy("el") });
    assert.match(html, /<html lang="el">/);
    assert.ok(!html.includes("Book your next visit online"));
  });
});
