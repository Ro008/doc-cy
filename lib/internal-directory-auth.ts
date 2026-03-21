import { cookies } from "next/headers";

const COOKIE = "doccy-internal-directory";

/**
 * True when the request carries the internal directory gate cookie matching the server secret.
 */
export function isInternalDirectoryAuthenticated(): boolean {
  const secret = process.env.INTERNAL_DIRECTORY_SECRET?.trim();
  if (!secret) return false;
  const cookie = cookies().get(COOKIE)?.value;
  return cookie === secret;
}
