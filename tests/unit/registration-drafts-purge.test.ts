import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  planRegistrationDraftPurge,
  purgeExpiredRegistrationDrafts,
  type ExpiredRegistrationDraft,
} from "../../lib/registration-drafts-purge";

/**
 * A daily cron deletes registration drafts still waiting after 7 days: the applicant
 * never clicked DocCy's confirmation link (Supabase marks every login confirmed at
 * once, so the link is the only proof). The draft and its photo go; the login goes
 * too unless it has history (an earlier request or a profile), so someone applying
 * again never loses their account.
 */

const newcomer: ExpiredRegistrationDraft = {
  draft_id: "d1",
  auth_user_id: "u1",
  requester_email: "a@example.org",
  photo_path: "professional_registration/u1/photo-a.jpg",
  login_has_history: false,
};
const noPhoto: ExpiredRegistrationDraft = { ...newcomer, draft_id: "d2", auth_user_id: "u2", photo_path: null };
const reapplicant: ExpiredRegistrationDraft = {
  ...newcomer,
  draft_id: "d3",
  auth_user_id: "u3",
  photo_path: "professional_registration/u3/photo-b.jpg",
  login_has_history: true,
};

describe("planRegistrationDraftPurge", () => {
  it("deletes newcomers' logins (the draft goes with them) and only the draft of a login with history", () => {
    assert.deepEqual(planRegistrationDraftPurge([newcomer, noPhoto, reapplicant]), {
      deleteLogins: [
        { authUserId: "u1", photoPath: "professional_registration/u1/photo-a.jpg" },
        { authUserId: "u2", photoPath: null },
      ],
      deleteDrafts: [{ draftId: "d3", photoPath: "professional_registration/u3/photo-b.jpg" }],
    });
  });

  it("never moves a waiting draft into the founders' queue", () => {
    const plan = planRegistrationDraftPurge([newcomer]) as Record<string, unknown>;
    assert.equal("confirm" in plan, false);
  });

  it("does nothing with nothing expired", () => {
    assert.deepEqual(planRegistrationDraftPurge([]), { deleteLogins: [], deleteDrafts: [] });
  });
});

describe("purgeExpiredRegistrationDrafts", () => {
  it("removes the photo first, and one failure doesn't stop the rest", async () => {
    const calls: string[] = [];
    const result = await purgeExpiredRegistrationDrafts({
      listExpired: async () => [newcomer, noPhoto, reapplicant],
      removePhoto: async (path) => {
        calls.push(`photo ${path}`);
      },
      deleteLogin: async (id) => {
        calls.push(`login ${id}`);
        if (id === "u1") throw new Error("auth down");
      },
      deleteDraft: async (id) => {
        calls.push(`draft ${id}`);
      },
    });
    assert.deepEqual(calls, [
      "photo professional_registration/u1/photo-a.jpg",
      "login u1",
      "login u2",
      "photo professional_registration/u3/photo-b.jpg",
      "draft d3",
    ]);
    assert.deepEqual(result, { deleted: 2, failed: 1 });
  });

  it("reports a listing failure instead of throwing", async () => {
    const result = await purgeExpiredRegistrationDrafts({
      listExpired: async () => {
        throw new Error("db down");
      },
      removePhoto: async () => {},
      deleteLogin: async () => {},
      deleteDraft: async () => {},
    });
    assert.deepEqual(result, { deleted: 0, failed: 1 });
  });
});
