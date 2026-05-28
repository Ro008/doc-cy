/** Route shown while license verification is pending or rejected (no agenda product). */
export const DOCTOR_ACCOUNT_REVIEW_PATH = "/agenda/account-review";

export type DoctorVerificationStatus = "pending" | "verified" | "rejected";

export function normalizeDoctorVerificationStatus(
  status: string | null | undefined,
): DoctorVerificationStatus {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "verified" || s === "rejected") return s;
  return "pending";
}

/** Full DocCy doctor product (agenda, settings, insights) only when license is verified. */
export function isDoctorVerifiedForProduct(
  status: string | null | undefined,
): boolean {
  return normalizeDoctorVerificationStatus(status) === "verified";
}

/** Blocked from agenda product until DocCy verifies the professional license. */
export function needsLicenseReviewGate(
  status: string | null | undefined,
): boolean {
  return !isDoctorVerifiedForProduct(status);
}

export function isDoctorAccountReviewPath(pathname: string): boolean {
  const norm = pathname.replace(/\/$/, "") || "/";
  return (
    norm === DOCTOR_ACCOUNT_REVIEW_PATH ||
    norm.startsWith(`${DOCTOR_ACCOUNT_REVIEW_PATH}/`)
  );
}

/** Distinguish specialty rejection vs license rejection on the doctor-facing screen. */
export type DoctorRejectionKind = "specialty" | "license";

export function getDoctorRejectionKind(input: {
  status: string | null | undefined;
  is_specialty_approved?: boolean | null;
}): DoctorRejectionKind | null {
  if (normalizeDoctorVerificationStatus(input.status) !== "rejected") return null;
  return input.is_specialty_approved === false ? "specialty" : "license";
}
