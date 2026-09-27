import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  planRegistrationDraftPurge,
  purgeExpiredRegistrationDrafts,
  type ExpiredRegistrationDraft,
} from "../../lib/registration-drafts-purge";

/**
 * A daily cron deletes registration drafts whose email is still unconfirmed after
 * 7 days, together with their login and photo. A draft whose email *was*
 * confirmed but never moved (the confirm step failed) is moved now instead.
 */

const unconfirmed: ExpiredRegistrationDraft = {
  draft_id: "d1",
  auth_user_id: "u1",
  requester_email: "a@example.org",
  email_confirmed: false,
  photo_path: "professional_registration/u1/photo-a.jpg",
};
const noPhoto: ExpiredRegistrationDraft = { ...unconfirmed, draft_id: "d2", auth_user_id: "u2", photo_path: null };
const confirmed: ExpiredRegistrationDraft = { ...unconfirmed, draft_id: "d3", auth_user_id: "u3", email_confirmed: true };

describe("planRegistrationDraftPurge", () => {
  it("deletes unconfirmed drafts' logins and photos, and moves confirmed ones", () => {
    assert.deepEqual(planRegistrationDraftPurge([unconfirmed, noPhoto, confirmed]), {
      deleteLogins: [
        { authUserId: "u1", photoPath: "professional_registration/u1/photo-a.jpg" },
        { authUserId: "u2", photoPath: null },
      ],
      confirm: ["u3"],
    });
  });

  it("does nothing with nothing expired", () => {
    assert.deepEqual(planRegistrationDraftPurge([]), { deleteLogins: [], confirm: [] });
  });
});

describe("purgeExpiredRegistrationDrafts", () => {
  it("removes the photo before the login, and one failure doesn't stop the rest", async () => {
    const calls: string[] = [];
    const result = await purgeExpiredRegistrationDrafts({
      listExpired: async () => [unconfirmed, noPhoto, confirmed],
      removePhoto: async (path) => {
        calls.push(`photo ${path}`);
      },
      deleteLogin: async (id) => {
        calls.push(`login ${id}`);
        if (id === "u1") throw new Error("auth down");
      },
      confirmDraft: async (id) => {
        calls.push(`confirm ${id}`);
      },
    });
    assert.deepEqual(calls, [
      "photo professional_registration/u1/photo-a.jpg",
      "login u1",
      "login u2",
      "confirm u3",
    ]);
    assert.deepEqual(result, { deleted: 1, confirmed: 1, failed: 1 });
  });

  it("reports a listing failure instead of throwing", async () => {
    const result = await purgeExpiredRegistrationDrafts({
      listExpired: async () => {
        throw new Error("db down");
      },
      removePhoto: async () => {},
      deleteLogin: async () => {},
      confirmDraft: async () => {},
    });
    assert.deepEqual(result, { deleted: 0, confirmed: 0, failed: 1 });
  });
});
