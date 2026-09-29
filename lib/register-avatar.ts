/** Profile photo checks on /register, before the crop dialog opens. */

/** Square crop is exported at 900×900; below this the profile photo looks soft. */
export const REGISTER_AVATAR_MIN_PX = 400;

export const REGISTER_AVATAR_MAX_BYTES = 10 * 1024 * 1024;

export const REGISTER_AVATAR_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

type AvatarFileLike = { name: string; type: string; size: number };

function isHeic(file: AvatarFileLike): boolean {
  return /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/** A message to show, or null when the file can go to the crop dialog. */
export function avatarFileProblem(file: AvatarFileLike): string | null {
  // iPhone's default format: most browsers cannot decode it, so say what to do.
  if (isHeic(file)) {
    return "HEIC photos (the iPhone default) can't be opened here. Export it as JPG or PNG and try again.";
  }
  if (!file.type.startsWith("image/")) {
    return "Please choose a JPG, PNG or WebP image.";
  }
  if (file.size > REGISTER_AVATAR_MAX_BYTES) {
    return "This photo is over 10 MB. Please use a smaller one.";
  }
  return null;
}

/** The crop is square, so the shorter side decides whether it will look sharp. */
export function avatarDimensionsProblem(width: number, height: number): string | null {
  if (Math.min(width, height) >= REGISTER_AVATAR_MIN_PX) return null;
  return `This photo is too small (${width}×${height} px). Use one at least ${REGISTER_AVATAR_MIN_PX}×${REGISTER_AVATAR_MIN_PX} px so it looks sharp on your profile.`;
}
