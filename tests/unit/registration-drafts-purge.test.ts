import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  planRegistrationDraftPurge,
  purgeExpiredRegistrationDrafts,
  type ExpiredRegistrationDraft,
} from "../../lib/registration-drafts-purge";
import {
  DENIED_PHOTO_KEEP_DAYS,
  deniedPhotoWindow,
  purgeDeniedPhotos,
  removePhotosAfterApproval,
  waitingPhotoPath,
} from "../../lib/photo-cleanup";

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

/**
 * Photo clean-up (user, 2026-10-12): once a founder approves a photo, the copy that
 * waited in the private bucket and the photo it replaces are deleted. A denied photo
 * is kept about 90 days, then the same daily cron deletes it.
 */
describe("photo clean-up", () => {
  it("finds the waiting photo of a photo change and of a registration", () => {
    assert.equal(waitingPhotoPath({ photo_path: " professional_photo_change/p1/a.jpg " }), "professional_photo_change/p1/a.jpg");
    assert.equal(
      waitingPhotoPath({ photo: { bucket: "request-uploads", path: "professional_registration/u1/photo.jpg" } }),
      "professional_registration/u1/photo.jpg",
    );
    assert.equal(waitingPhotoPath({ photo: null }), null);
    assert.equal(waitingPhotoPath({ photo_path: "" }), null);
    assert.equal(waitingPhotoPath(null), null);
  });

  it("after an approval: the waiting copies and the replaced photo go, the new one stays", async () => {
    const calls: string[] = [];
    await removePhotosAfterApproval(
      async (bucket, path) => {
        calls.push(`${bucket} ${path}`);
      },
      {
        waitingPaths: ["professional_photo_change/p1/a.jpg", null, "professional_photo_change/p1/a.jpg", "x/founder-1.jpg"],
        replacedAvatar: "profiles/u1/avatar-old.jpg",
        newAvatar: "profiles/u1/avatar-new.jpg",
      },
    );
    assert.deepEqual(calls, [
      "request-uploads professional_photo_change/p1/a.jpg",
      "request-uploads x/founder-1.jpg",
      "avatars profiles/u1/avatar-old.jpg",
    ]);
  });

  it("never deletes the photo that just went live, a web address, or nothing", async () => {
    for (const replacedAvatar of ["profiles/u1/avatar-new.jpg", "https://example.org/a.jpg", "", null, undefined]) {
      const calls: string[] = [];
      await removePhotosAfterApproval(
        async (bucket, path) => {
          calls.push(`${bucket} ${path}`);
        },
        { waitingPaths: [], replacedAvatar, newAvatar: "profiles/u1/avatar-new.jpg" },
      );
      assert.deepEqual(calls, [], String(replacedAvatar));
    }
  });

  it("a file that will not delete never undoes the approval", async () => {
    const calls: string[] = [];
    await removePhotosAfterApproval(
      async (bucket, path) => {
        calls.push(`${bucket} ${path}`);
        throw new Error("storage down");
      },
      { waitingPaths: ["w/a.jpg"], replacedAvatar: "profiles/u1/old.jpg", newAvatar: "profiles/u1/new.jpg" },
    );
    assert.deepEqual(calls, ["request-uploads w/a.jpg", "avatars profiles/u1/old.jpg"]);
  });

  it("denied photos are looked for from 90 days after the decision, for 30 days", () => {
    assert.equal(DENIED_PHOTO_KEEP_DAYS, 90);
    assert.deepEqual(deniedPhotoWindow(new Date("2027-01-31T02:30:00.000Z")), {
      decidedFrom: "2026-10-03T02:30:00.000Z",
      decidedBefore: "2026-11-02T02:30:00.000Z",
    });
  });

  it("deletes each denied photo, carries on after a failure, and counts both", async () => {
    const calls: string[] = [];
    const result = await purgeDeniedPhotos({
      listDenied: async () => [
        { id: "r1", details: { photo_path: "professional_photo_change/p1/a.jpg" } },
        { id: "r2", details: { photo: { path: "professional_registration/u2/b.jpg" } } },
        { id: "r3", details: { photo: null } },
        { id: "r4", details: { photo_path: "professional_photo_change/p4/d.jpg" } },
      ],
      removePhoto: async (path) => {
        calls.push(path);
        if (path.includes("/u2/")) throw new Error("storage down");
      },
    });
    assert.deepEqual(calls, [
      "professional_photo_change/p1/a.jpg",
      "professional_registration/u2/b.jpg",
      "professional_photo_change/p4/d.jpg",
    ]);
    assert.deepEqual(result, { deleted: 2, failed: 1 });
  });

  it("reports a listing failure instead of throwing", async () => {
    const result = await purgeDeniedPhotos({
      listDenied: async () => {
        throw new Error("db down");
      },
      removePhoto: async () => {},
    });
    assert.deepEqual(result, { deleted: 0, failed: 1 });
  });
});
