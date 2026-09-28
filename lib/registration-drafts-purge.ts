/**
 * Daily purge of registration drafts (cron `/api/cron/purge-registration-drafts`).
 * A draft still here after 7 days means the applicant never clicked DocCy's
 * confirmation link. Supabase marks every login confirmed at once (both projects),
 * so that link is the only proof the address works: a waiting draft is deleted,
 * never moved into the founders' queue. Its photo goes too, and so does its login,
 * unless the login has history (an earlier request or a profile) - someone applying
 * again never loses their account.
 */

export type ExpiredRegistrationDraft = {
  draft_id: string;
  auth_user_id: string;
  requester_email: string;
  photo_path: string | null;
  /** The login made earlier requests or has a profile: keep it. */
  login_has_history: boolean;
};

export type RegistrationDraftPurgePlan = {
  /** Deleting the login deletes its draft (ON DELETE CASCADE). */
  deleteLogins: { authUserId: string; photoPath: string | null }[];
  deleteDrafts: { draftId: string; photoPath: string | null }[];
};

export function planRegistrationDraftPurge(rows: ExpiredRegistrationDraft[]): RegistrationDraftPurgePlan {
  const plan: RegistrationDraftPurgePlan = { deleteLogins: [], deleteDrafts: [] };
  for (const row of rows) {
    if (row.login_has_history) {
      plan.deleteDrafts.push({ draftId: row.draft_id, photoPath: row.photo_path });
    } else {
      plan.deleteLogins.push({ authUserId: row.auth_user_id, photoPath: row.photo_path });
    }
  }
  return plan;
}

export type RegistrationDraftPurgeDeps = {
  listExpired: () => Promise<ExpiredRegistrationDraft[]>;
  removePhoto: (path: string) => Promise<void>;
  deleteLogin: (authUserId: string) => Promise<void>;
  deleteDraft: (draftId: string) => Promise<void>;
};

export async function purgeExpiredRegistrationDrafts(
  deps: RegistrationDraftPurgeDeps,
): Promise<{ deleted: number; failed: number }> {
  const result = { deleted: 0, failed: 0 };
  let rows: ExpiredRegistrationDraft[];
  try {
    rows = await deps.listExpired();
  } catch (error) {
    console.error("[DocCy] registration draft purge: listing failed", error);
    result.failed += 1;
    return result;
  }

  const plan = planRegistrationDraftPurge(rows);
  // Photo first: once the login or draft is gone, nothing points at the photo any more.
  for (const { authUserId, photoPath } of plan.deleteLogins) {
    try {
      if (photoPath) await deps.removePhoto(photoPath);
      await deps.deleteLogin(authUserId);
      result.deleted += 1;
    } catch (error) {
      console.error("[DocCy] registration draft purge: login delete failed", { authUserId, error });
      result.failed += 1;
    }
  }
  for (const { draftId, photoPath } of plan.deleteDrafts) {
    try {
      if (photoPath) await deps.removePhoto(photoPath);
      await deps.deleteDraft(draftId);
      result.deleted += 1;
    } catch (error) {
      console.error("[DocCy] registration draft purge: draft delete failed", { draftId, error });
      result.failed += 1;
    }
  }
  return result;
}
