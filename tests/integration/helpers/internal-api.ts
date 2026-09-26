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

export function postSpecialtyChangeReview(
  request: APIRequestContext,
  adminCookie: string,
  body: { requestId: string; action: "approve" | "reject" },
) {
  return request.post("/api/internal/doctors/specialty-change-review", {
    headers: internalDirectoryHeaders(adminCookie),
    data: body,
  });
}

export function postDoctorVerification(
  request: APIRequestContext,
  adminCookie: string,
  body: { doctorId: string; action: "verify" | "reject"; listingUrl?: string },
) {
  return request.post("/api/internal/doctors/verification", {
    headers: internalDirectoryHeaders(adminCookie),
    data: body,
  });
}

export function postPendingRegistrationTwin(
  request: APIRequestContext,
  adminCookie: string,
  body: {
    registeredId: string;
    unregisteredId?: string;
    listingUrl?: string;
    action: "absorb" | "keep_both";
  },
) {
  return request.post("/api/internal/pending-registration-twin", {
    headers: internalDirectoryHeaders(adminCookie),
    data: body,
  });
}
