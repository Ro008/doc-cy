export const INTERNAL_DIRECTORY_COOKIE = "doccy-internal-directory";

export type InternalDirectoryRole = "founder" | "partner";

export type InternalDirectorySecrets = {
  founder: string;
  partner: string;
};

export function readInternalDirectorySecrets(
  env: NodeJS.ProcessEnv = process.env,
): InternalDirectorySecrets {
  return {
    founder: String(env.INTERNAL_DIRECTORY_SECRET ?? "").trim(),
    partner: String(env.INTERNAL_DIRECTORY_PARTNER_SECRET ?? "").trim(),
  };
}

/**
 * Map the httpOnly gate cookie to a role. Founder secret wins if both env vars
 * are accidentally set to the same value (partner must be a distinct password).
 */
export function roleFromCookieValue(
  cookie: string | undefined | null,
  secrets: InternalDirectorySecrets = readInternalDirectorySecrets(),
): InternalDirectoryRole | null {
  const value = String(cookie ?? "");
  if (!value) return null;
  if (secrets.founder && value === secrets.founder) return "founder";
  if (secrets.partner && secrets.partner !== secrets.founder && value === secrets.partner) {
    return "partner";
  }
  return null;
}

export function isInternalDirectoryCookieAuthorized(
  cookie: string | undefined | null,
  secrets: InternalDirectorySecrets = readInternalDirectorySecrets(),
): boolean {
  return roleFromCookieValue(cookie, secrets) !== null;
}
