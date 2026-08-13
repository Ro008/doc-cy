/** Shared across visitors; listings change rarely compared with live slots. */
export const FINDER_DIRECTORY_REVALIDATE_SECONDS = 45;
export const FINDER_DIRECTORY_CACHE_TAG = "finder-directory";

export function directoryIdSetCacheKey(ids: readonly string[]): string {
  const unique = Array.from(new Set(ids.filter(Boolean))).sort();
  let hash = 0;
  for (const id of unique) {
    for (let i = 0; i < id.length; i += 1) {
      hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
  }
  return `${unique.length}:${hash}`;
}
