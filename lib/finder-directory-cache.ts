import { unstable_cache } from "next/cache";

import { finderIncludesRegisteredTestProfiles } from "@/lib/doctor-test-profile";
import {
  FINDER_DIRECTORY_CACHE_TAG,
  FINDER_DIRECTORY_REVALIDATE_SECONDS,
} from "@/lib/finder-directory-cache-key";

export {
  FINDER_DIRECTORY_CACHE_TAG,
  FINDER_DIRECTORY_REVALIDATE_SECONDS,
  directoryIdSetCacheKey,
} from "@/lib/finder-directory-cache-key";

type DirectoryError = { code?: string; message?: string };

/** Integration Playwright creates doctors mid-run; a 45s listing cache would hide them. */
export function shouldBypassFinderDirectoryCache(): boolean {
  return finderIncludesRegisteredTestProfiles();
}

export class FinderDirectoryLoadError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "FinderDirectoryLoadError";
    this.code = code;
  }
}

export async function getCachedDirectoryPayload<T>(
  keyParts: readonly string[],
  load: () => Promise<T>,
): Promise<T> {
  if (shouldBypassFinderDirectoryCache()) {
    return load();
  }
  return unstable_cache(load, [FINDER_DIRECTORY_CACHE_TAG, ...keyParts], {
    revalidate: FINDER_DIRECTORY_REVALIDATE_SECONDS,
    tags: [FINDER_DIRECTORY_CACHE_TAG],
  })();
}

/**
 * Cache successful directory row loads. Errors are not stored, so a schema miss
 * can fall through to the next select attempt.
 */
export async function getCachedDirectoryRows<T>(
  keyParts: readonly string[],
  load: () => Promise<{ data: T[] | null; error: DirectoryError | null }>,
): Promise<{ data: T[] | null; error: DirectoryError | null }> {
  try {
    const data = await getCachedDirectoryPayload(keyParts, async () => {
      const result = await load();
      if (result.error) {
        throw new FinderDirectoryLoadError(
          result.error.message ?? "directory_load_failed",
          result.error.code,
        );
      }
      return result.data ?? [];
    });
    return { data, error: null };
  } catch (err) {
    if (err instanceof FinderDirectoryLoadError) {
      return { data: null, error: { code: err.code, message: err.message } };
    }
    throw err;
  }
}
