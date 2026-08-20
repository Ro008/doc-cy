import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OUTREACH_MIN_BOOKING_COUNT,
  OUTREACH_MIN_TOTAL_COUNT,
  buildDirectoryManualOutreachEmail,
  countByManualId,
  directoryManualProfileUrl,
  mergeOutreachCounts,
  shouldSendDirectoryOutreach,
  sortOutreachCandidates,
} from "@/lib/directory-manual-outreach";
import {
  createOutreachUnsubscribeToken,
  outreachUnsubscribeTokenIsValid,
} from "@/lib/directory-manual-outreach-token";

describe("directory outreach thresholds", () => {
  it("sends when booking attempts meet the booking floor", () => {
    assert.equal(
      shouldSendDirectoryOutreach({ bookingCount: OUTREACH_MIN_BOOKING_COUNT, phoneClickCount: 0 }),
      true,
    );
    assert.equal(
      shouldSendDirectoryOutreach({ bookingCount: OUTREACH_MIN_BOOKING_COUNT - 1, phoneClickCount: 0 }),
      false,
    );
  });

  it("sends when bookings plus phone taps meet the combined floor", () => {
    assert.equal(
      shouldSendDirectoryOutreach({ bookingCount: 1, phoneClickCount: OUTREACH_MIN_TOTAL_COUNT - 1 }),
      true,
    );
    assert.equal(
      shouldSendDirectoryOutreach({ bookingCount: 0, phoneClickCount: OUTREACH_MIN_TOTAL_COUNT - 1 }),
      false,
    );
  });
});

describe("directory outreach aggregation", () => {
  it("counts rows by manual id and merges both signals", () => {
    const bookings = countByManualId([
      { manual_id: "a" },
      { manual_id: "a" },
      { manual_id: "b" },
    ]);
    const phones = countByManualId([{ manual_id: "b" }, { manual_id: "c" }]);
    const merged = mergeOutreachCounts(bookings, phones);
    const byId = new Map(merged.map((row) => [row.manualId, row]));
    assert.equal(byId.get("a")?.bookingCount, 2);
    assert.equal(byId.get("a")?.phoneClickCount, 0);
    assert.equal(byId.get("b")?.bookingCount, 1);
    assert.equal(byId.get("b")?.phoneClickCount, 1);
    assert.equal(byId.get("c")?.bookingCount, 0);
    assert.equal(byId.get("c")?.phoneClickCount, 1);
  });

  it("ranks by booking count, then total", () => {
    const ranked = sortOutreachCandidates([
      { manualId: "low", bookingCount: 1, phoneClickCount: 8 },
      { manualId: "high-bookings", bookingCount: 9, phoneClickCount: 0 },
      { manualId: "mid", bookingCount: 4, phoneClickCount: 1 },
    ]);
    assert.deepEqual(
      ranked.map((row) => row.manualId),
      ["high-bookings", "mid", "low"],
    );
  });
});

describe("directory outreach email", () => {
  const siteUrl = "https://www.mydoccy.com";

  it("sums booking and phone intent, uses the personal copy, and skips the navy shell", () => {
    const email = buildDirectoryManualOutreachEmail({
      siteUrl,
      professionalName: "Abdul Rahman Rizeq",
      slug: "abdul-rahman-rizeq-larnaca",
      bookingCount: 4,
      phoneClickCount: 2,
    });

    assert.match(email.subject, /Abdul, last week 6 patients tried to book with you on DocCy/);
    assert.match(email.text, /^Hi Abdul,/m);
    assert.match(
      email.text,
      /6 patients tried to book an appointment with you on DocCy last week, but couldn't/,
    );
    assert.match(email.html, /<strong>6 patients<\/strong>/);
    assert.equal(
      email.profileUrl,
      "https://www.mydoccy.com/finder/professional/abdul-rahman-rizeq-larnaca",
    );
    assert.equal(email.forProfessionalsUrl, "https://www.mydoccy.com/for-professionals");
    assert.match(email.html, /See your profile on DocCy/);
    assert.match(email.html, /Activate online booking \(Free, a few minutes\)/);
    assert.match(email.text, /free for a trial period/);
    assert.doesNotMatch(email.text, /completely free/);
    assert.match(email.text, /Paphos or nearby/);
    assert.match(email.text, /next available doctor/);
    assert.doesNotMatch(email.html, /#062F61/);
    assert.doesNotMatch(email.html, /#073B78/);
    assert.doesNotMatch(email.text, /unsubscribe/i);
    assert.doesNotMatch(email.html, /Unsubscribe/);
    assert.match(email.text, /^Founder$/m);
    assert.doesNotMatch(email.text, /Founder,/);
    assert.doesNotMatch(email.text, /Please do not reply/);
  });

  it("uses the combined count when phone taps dominate", () => {
    const email = buildDirectoryManualOutreachEmail({
      siteUrl,
      professionalName: "Maria Papadopoulou",
      slug: "maria-papadopoulou-paphos",
      bookingCount: 1,
      phoneClickCount: 6,
    });
    assert.match(email.subject, /7 patients tried to book with you on DocCy/);
    assert.match(email.text, /7 patients tried to book an appointment/);
    assert.doesNotMatch(email.text, /looked you up/);
    assert.doesNotMatch(email.text, /has tried/);
  });

  it("builds the profile URL", () => {
    assert.equal(
      directoryManualProfileUrl(siteUrl, "abdul-rahman-rizeq-larnaca"),
      "https://www.mydoccy.com/finder/professional/abdul-rahman-rizeq-larnaca",
    );
  });
});

describe("directory outreach unsubscribe token", () => {
  it("accepts the matching token and rejects a different listing", () => {
    const secret = "test-secret";
    const token = createOutreachUnsubscribeToken({
      manualId: "11111111-1111-4111-8111-111111111111",
      email: "Clinic@Example.com",
      secret,
    });
    assert.equal(
      outreachUnsubscribeTokenIsValid({
        manualId: "11111111-1111-4111-8111-111111111111",
        email: "clinic@example.com",
        token,
        secret,
      }),
      true,
    );
    assert.equal(
      outreachUnsubscribeTokenIsValid({
        manualId: "22222222-2222-4222-8222-222222222222",
        email: "clinic@example.com",
        token,
        secret,
      }),
      false,
    );
  });
});
