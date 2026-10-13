/**
 * Photo clean-up (user, 2026-10-12).
 *
 * A requested photo waits in the private `request-uploads` bucket; approving copies
 * it to the public `avatars` bucket. Once approved, the waiting copy and the photo
 * it replaces are deleted. A withdrawn photo change is deleted at once (elsewhere).
 * A denied photo is kept about 90 days, then the daily cron
 * (`/api/cron/purge-registration-drafts`) deletes it.
 */

export type PhotoBucket = "request-uploads" | "avatars";

/** A denied photo is kept this long after the decision. */
export const DENIED_PHOTO_KEEP_DAYS = 90;
/**
 * The cron looks at decisions this many days past the keep time, so a failed delete is
 * tried again daily for a month. request_log is append-only: nothing marks a row done.
 */
export const DENIED_PHOTO_SWEEP_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

function trimmed(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The photo waiting with a request: a photo change keeps `photo_path`, a registration `photo.path`. */
export function waitingPhotoPath(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const record = details as { photo_path?: unknown; photo?: { path?: unknown } | null };
  return trimmed(record.photo_path) ?? trimmed(record.photo?.path);
}

/** Decisions whose photo is due: older than the keep time, by at most the sweep time. */
export function deniedPhotoWindow(now: Date): { decidedFrom: string; decidedBefore: string } {
  const before = now.getTime() - DENIED_PHOTO_KEEP_DAYS * DAY_MS;
  return {
    decidedFrom: new Date(before - DENIED_PHOTO_SWEEP_DAYS * DAY_MS).toISOString(),
    decidedBefore: new Date(before).toISOString(),
  };
}

/**
 * After a founder approved a photo: the waiting copies and the replaced photo go.
 * Never throws: the approval stands even if a file stays behind.
 */
export async function removePhotosAfterApproval(
  remove: (bucket: PhotoBucket, path: string) => Promise<void>,
  input: {
    waitingPaths: ReadonlyArray<string | null | undefined>;
    replacedAvatar: string | null | undefined;
    newAvatar: string | null;
  },
): Promise<void> {
  const targets: { bucket: PhotoBucket; path: string }[] = [];
  const waiting = new Set(input.waitingPaths.map(trimmed).filter((path): path is string => Boolean(path)));
  waiting.forEach((path) => targets.push({ bucket: "request-uploads", path }));
  const replaced = trimmed(input.replacedAvatar);
  if (replaced && replaced !== trimmed(input.newAvatar) && !/^https?:\/\//i.test(replaced)) {
    targets.push({ bucket: "avatars", path: replaced });
  }
  for (const { bucket, path } of targets) {
    try {
      await remove(bucket, path);
    } catch (error) {
      console.error("[DocCy] photo clean-up: file stays", { bucket, path, error });
    }
  }
}

export type DeniedPhotoPurgeDeps = {
  /** Denied (or withdrawn) requests whose decision falls in `deniedPhotoWindow`. */
  listDenied: () => Promise<{ id: string; details: unknown }[]>;
  removePhoto: (path: string) => Promise<void>;
};

export async function purgeDeniedPhotos(deps: DeniedPhotoPurgeDeps): Promise<{ deleted: number; failed: number }> {
  const result = { deleted: 0, failed: 0 };
  let rows: { id: string; details: unknown }[];
  try {
    rows = await deps.listDenied();
  } catch (error) {
    console.error("[DocCy] denied photo purge: listing failed", error);
    result.failed += 1;
    return result;
  }
  for (const row of rows) {
    const path = waitingPhotoPath(row.details);
    if (!path) continue;
    try {
      await deps.removePhoto(path);
      result.deleted += 1;
    } catch (error) {
      console.error("[DocCy] denied photo purge: delete failed", { requestId: row.id, error });
      result.failed += 1;
    }
  }
  return result;
}

/** `remove` for `removePhotosAfterApproval`, on a service-role client. */
export function storageRemover(service: {
  storage: { from: (bucket: string) => { remove: (paths: string[]) => Promise<{ error: { message: string } | null }> } };
}): (bucket: PhotoBucket, path: string) => Promise<void> {
  return async (bucket, path) => {
    const { error } = await service.storage.from(bucket).remove([path]);
    if (error) throw new Error(error.message);
  };
}
