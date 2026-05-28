import { needsLicenseReviewGate } from "@/lib/doctor-account-access";

export const DOCTOR_PRODUCT_LOCKED_MESSAGE =
  "Your account is under review. Agenda and settings are not available yet.";

/** Returns an HTTP status when the doctor must not use product APIs. */
export function doctorProductLockedStatus(
  status: string | null | undefined,
): 403 | null {
  return needsLicenseReviewGate(status) ? 403 : null;
}
