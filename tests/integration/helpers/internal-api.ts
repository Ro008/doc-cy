import type { APIRequestContext } from "@playwright/test";

export function internalDirectoryHeaders(secret: string): { Cookie: string } {
  return { Cookie: `doccy-internal-directory=${secret}` };
}

export function postSpecialtyReview(
  request: APIRequestContext,
  secret: string,
  body: {
    doctorId: string;
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
