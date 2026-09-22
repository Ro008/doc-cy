import { resolveShareAvatarUrl } from "@/lib/doctor-seo-formatting";
import { resolveFinderDisplayPhotoUrl } from "@/lib/finder-default-avatars";

/**
 * The photo for one professional on a clinic page.
 *
 * The roster used to resolve straight from `gender` to a placeholder illustration,
 * because it only ever listed scraped directory rows, which have no upload. Verify
 * puts registered professionals on these pages too, and they do have one:
 * `professionals.avatar_url`, a path in the `avatars` storage bucket.
 *
 * Skipping it was doubly wrong — it hid a photo the professional chose, and fell
 * through to a gender default that registration never collects, so "unknown" resolved
 * to the male illustration for everyone verified.
 *
 * Order: their own upload, then a curated directory photo, then the placeholder.
 */
export function clinicRosterPhotoUrl(input: {
  avatarUrl?: string | null;
  gender?: unknown;
  addressMapsLink?: string | null;
  /** Curated photo for scraped listings, keyed off the maps link. */
  curatedPhotoUrl?: string | null;
  getStoragePublicUrl: (path: string) => string;
}): string {
  const uploaded = resolveShareAvatarUrl(input.avatarUrl, input.getStoragePublicUrl);
  return resolveFinderDisplayPhotoUrl({
    curatedOrCustomPhotoUrl: uploaded ?? input.curatedPhotoUrl ?? null,
    gender: input.gender,
  });
}
