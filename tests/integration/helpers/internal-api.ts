import { adminCookieHeader, sharedTestFounder } from "./test-admin";

/** Session cookie of this worker's test founder (real login, verified TOTP). */
export async function founderCookie(): Promise<string> {
  return adminCookieHeader(await sharedTestFounder());
}

export function internalDirectoryHeaders(adminCookie: string): { Cookie: string } {
  return { Cookie: adminCookie };
}
