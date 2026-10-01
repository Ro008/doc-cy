import type { APIRequestContext } from "@playwright/test";
import { adminCookieHeader, sharedTestFounder } from "./test-admin";

/** Session cookie of this worker's test founder (real login, verified TOTP). */
export async function founderCookie(): Promise<string> {
  return adminCookieHeader(await sharedTestFounder());
}

export function internalDirectoryHeaders(adminCookie: string): { Cookie: string } {
  return { Cookie: adminCookie };
}

export function postSpecialtyReview(
  request: APIRequestContext,
  adminCookie: string,
  body: {
    doctorId: string;
    specialtyId?: string | null;
    action: "map" | "approve_new" | "approve_edited" | "reject_specialty";
    mapTo?: string;
    editedSpecialty?: string;
  },
) {
  return request.post("/api/internal/doctors/specialty-review", {
    headers: internalDirectoryHeaders(adminCookie),
    data: body,
  });
}
