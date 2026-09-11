import type { APIRequestContext } from "@playwright/test";

export function internalDirectoryHeaders(secret: string): { Cookie: string } {
  return { Cookie: `doccy-internal-directory=${secret}` };
}

export function postSpecialtyReview(
  request: APIRequestContext,
  secret: string,
  body: {
    doctorId: string;
    specialtyId?: string | null;
    action: "map" | "approve_new" | "approve_edited" | "reject_specialty";
    mapTo?: string;
    editedSpecialty?: string;
  },
) {
  return request.post("/api/internal/doctors/specialty-review", {
    headers: internalDirectoryHeaders(secret),
    data: body,
  });
}

export function postDoctorVerification(
  request: APIRequestContext,
  secret: string,
  body: { doctorId: string; action: "verify" | "reject" },
) {
  return request.post("/api/internal/doctors/verification", {
    headers: internalDirectoryHeaders(secret),
    data: body,
  });
}

export function postPendingRegistrationTwin(
  request: APIRequestContext,
  secret: string,
  body: {
    registeredId: string;
    unregisteredId?: string;
    listingUrl?: string;
    action: "absorb" | "keep_both";
  },
) {
  return request.post("/api/internal/pending-registration-twin", {
    headers: internalDirectoryHeaders(secret),
    data: body,
  });
}
