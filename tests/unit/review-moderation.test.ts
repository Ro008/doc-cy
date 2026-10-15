import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  REVIEW_MODERATION_RECENT_LIMIT,
  reviewModerationItems,
  reviewStatusForAction,
  type ReviewModerationRow,
} from "../../lib/review-moderation";

/**
 * Reviews wait for the founders (user, 2026-10-15): a patient's review is stored as
 * pending and only shows once a founder approves it. A rejection is final and nobody is
 * told: not the patient, not the professional. No emails either way.
 */

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

const row = (over: Partial<ReviewModerationRow>): ReviewModerationRow => ({
  id: "r1",
  professional_id: "p1",
  appointment_id: "a1",
  rating: 4,
  comment: "Kind and thorough.",
  reviewer_name: "Maria Kyriakou",
  reviewer_email: "maria@example.com",
  status: "pending",
  created_at: "2026-10-15T09:00:00Z",
  moderated_at: null,
  ...over,
});

const pros = new Map([["p1", { name: "Dr Elena Christou", slug: "elena-christou" }]]);
const visits = new Map([["a1", "2026-10-13T08:30:00Z"]]);

describe("reviewStatusForAction", () => {
  it("approving publishes, rejecting rejects", () => {
    assert.equal(reviewStatusForAction("approve"), "published");
    assert.equal(reviewStatusForAction("reject"), "rejected");
  });

  it("anything else is not an action", () => {
    for (const bad of ["publish", "hide", "", null, undefined, 1]) {
      assert.equal(reviewStatusForAction(bad), null, String(bad));
    }
  });
});

describe("reviewModerationItems", () => {
  it("shows the professional, the patient, how the name will appear and the visit date", () => {
    const { pending } = reviewModerationItems([row({})], pros, visits);
    assert.deepEqual(pending, [
      {
        id: "r1",
        status: "pending",
        rating: 4,
        comment: "Kind and thorough.",
        reviewerName: "Maria Kyriakou",
        reviewerEmail: "maria@example.com",
        displayName: "Maria K.",
        professional: { id: "p1", name: "Dr Elena Christou", slug: "elena-christou" },
        visitAt: "2026-10-13T08:30:00Z",
        createdAt: "2026-10-15T09:00:00Z",
        moderatedAt: null,
      },
    ]);
  });

  it("puts the oldest pending first and the latest decisions first", () => {
    const { pending, decided } = reviewModerationItems(
      [
        row({ id: "new", created_at: "2026-10-15T10:00:00Z" }),
        row({ id: "old", created_at: "2026-10-14T10:00:00Z" }),
        row({ id: "ok", status: "published", moderated_at: "2026-10-14T12:00:00Z" }),
        row({ id: "no", status: "rejected", moderated_at: "2026-10-15T12:00:00Z" }),
      ],
      pros,
      visits,
    );
    assert.deepEqual(pending.map((item) => item.id), ["old", "new"]);
    assert.deepEqual(decided.map((item) => item.id), ["no", "ok"]);
  });

  it("leaves out hidden reviews and those decided before moderation existed", () => {
    const { pending, decided } = reviewModerationItems(
      [row({ id: "h", status: "hidden" }), row({ id: "legacy", status: "published", moderated_at: null })],
      pros,
      visits,
    );
    assert.equal(pending.length, 0);
    assert.equal(decided.length, 0);
  });

  it(`keeps only the last ${REVIEW_MODERATION_RECENT_LIMIT} decisions`, () => {
    const rows = Array.from({ length: REVIEW_MODERATION_RECENT_LIMIT + 5 }, (_, i) =>
      row({ id: `d${i}`, status: "published", moderated_at: new Date(Date.UTC(2026, 9, 1, i)).toISOString() }),
    );
    assert.equal(reviewModerationItems(rows, pros, visits).decided.length, REVIEW_MODERATION_RECENT_LIMIT);
  });

  it("copes with a professional or visit it can't find", () => {
    const { pending } = reviewModerationItems([row({ professional_id: "gone", appointment_id: "gone" })], pros, visits);
    assert.equal(pending[0].professional.name, "Unknown professional");
    assert.equal(pending[0].professional.slug, null);
    assert.equal(pending[0].visitAt, null);
  });
});

describe("where moderation is wired", () => {
  it("a new review is stored as pending", () => {
    assert.match(read("app/api/booking/review/route.ts"), /status:\s*"pending"/);
  });

  it("the patient is told it will be checked, not that it is published", () => {
    const form = read("components/booking/ReviewFormClient.tsx");
    assert.match(form, /checked and published soon/);
    assert.doesNotMatch(form, /is published as/);
    assert.doesNotMatch(form, /Publish review/);
  });

  it("the profile and the finder still only read published reviews", () => {
    const loader = read("lib/public/load-profile-reviews.ts");
    assert.equal(loader.match(/\.eq\("status", "published"\)/g)?.length, 2);
  });

  it("deciding sends no email", () => {
    const server = read("lib/review-moderation-server.ts");
    assert.doesNotMatch(server, /from "@\/lib\/[^"]*(email|resend)[^"]*"/i);
  });

  it("only founders decide", () => {
    for (const action of ["approve", "reject"]) {
      assert.match(read(`app/api/internal/reviews/[id]/${action}/route.ts`), /requireAdminWrite\(\)/);
    }
  });
});
