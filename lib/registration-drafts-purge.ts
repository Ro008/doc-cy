/**
 * Daily purge of registration drafts (cron `/api/cron/purge-registration-drafts`).
 * A draft whose email is still unconfirmed after 7 days goes, with its login
 * (the draft cascades) and its photo. A draft whose email *was* confirmed but
 * never moved into request_log (the confirm step failed) is moved now instead.
 */

export type ExpiredRegistrationDraft = {
  draft_id: string;
  auth_user_id: string;
  requester_email: string;
  email_confirmed: boolean;
  photo_path: string | null;
};

export type RegistrationDraftPurgePlan = {
  deleteLogins: { authUserId: string; photoPath: string | null }[];
  confirm: string[];
};

export function planRegistrationDraftPurge(rows: ExpiredRegistrationDraft[]): RegistrationDraftPurgePlan {
  const plan: RegistrationDraftPurgePlan = { deleteLogins: [], confirm: [] };
  for (const row of rows) {
    if (row.email_confirmed) {
      plan.confirm.push(row.auth_user_id);
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
  /** Moves a confirmed draft into request_log (and notifies the founders). */
  confirmDraft: (authUserId: string) => Promise<void>;
};

export async function purgeExpiredRegistrationDrafts(
  deps: RegistrationDraftPurgeDeps,
): Promise<{ deleted: number; confirmed: number; failed: number }> {
  const result = { deleted: 0, confirmed: 0, failed: 0 };
  let rows: ExpiredRegistrationDraft[];
  try {
    rows = await deps.listExpired();
  } catch (error) {
    console.error("[DocCy] registration draft purge: listing failed", error);
    result.failed += 1;
    return result;
  }

  const plan = planRegistrationDraftPurge(rows);
  for (const { authUserId, photoPath } of plan.deleteLogins) {
    try {
      // Photo first: once the login is gone, nothing points at the photo any more.
      if (photoPath) await deps.removePhoto(photoPath);
      await deps.deleteLogin(authUserId);
      result.deleted += 1;
    } catch (error) {
      console.error("[DocCy] registration draft purge: delete failed", { authUserId, error });
      result.failed += 1;
    }
  }
  for (const authUserId of plan.confirm) {
    try {
      await deps.confirmDraft(authUserId);
      result.confirmed += 1;
    } catch (error) {
      console.error("[DocCy] registration draft purge: confirm failed", { authUserId, error });
      result.failed += 1;
    }
  }
  return result;
}
