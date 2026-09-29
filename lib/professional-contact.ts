/**
 * A professional's registration email and personal mobile (`professionals.registration_email`,
 * `professionals.mobile_number`) belong to one real professional each. Test profiles
 * never block anyone. The database enforces it with unique indexes and answers
 * "is it taken?" with `professional_contact_in_use`; this module holds the shared
 * keys, messages and error mapping. No imports: the register form uses it too.
 *
 * The scraped directory `email` / `phone` columns are not part of this rule.
 */

export type ContactEmailUse = "professional" | "account" | null;

export type ProfessionalContactUse = {
  /** 'professional': another real professional or pending application; 'account': another login. */
  email: ContactEmailUse;
  mobile: boolean;
};

export const REGISTER_EMAIL_IN_USE_MESSAGE =
  "You can't continue: this email is already used by another professional. Sign in instead, or use a different email.";

export const REGISTER_ACCOUNT_EXISTS_MESSAGE =
  "An account with this email already exists. Try logging in or reset your password.";

export const REGISTER_MOBILE_IN_USE_MESSAGE =
  "You can't continue: this mobile number is already used by another professional. Enter your own personal mobile.";

/** Settings: a professional changing their mobile to one another professional uses. */
export const SETTINGS_MOBILE_IN_USE_MESSAGE =
  "This mobile number is already used by another professional. Enter your own personal mobile.";

/** Same comparison as the database: lowercased, trimmed. */
export function professionalEmailKey(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

/** Same comparison as the database: digits only ("+357 99 123456" = "+35799123456"). */
export function professionalMobileKey(mobile: string | null | undefined): string {
  return String(mobile ?? "").replace(/[^0-9]/g, "");
}

/** Reads `professional_contact_in_use`'s row (PostgREST returns an array). */
export function parseProfessionalContactUse(data: unknown): ProfessionalContactUse {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return { email: null, mobile: false };
  const { email_in_use: email, mobile_in_use: mobile } = row as Record<string, unknown>;
  return {
    email: email === "professional" || email === "account" ? email : null,
    mobile: mobile === true,
  };
}

/** The /register error code for a taken email or mobile (the email is reported first). */
export function registrationContactErrorCode(
  use: ProfessionalContactUse,
): "email_in_use" | "auth_user_exists" | "mobile_in_use" | null {
  if (use.email === "professional") return "email_in_use";
  if (use.email === "account") return "auth_user_exists";
  if (use.mobile) return "mobile_in_use";
  return null;
}

/** One message per taken field. Never names who uses it: it's someone's personal contact. */
export function registerContactMessages(use: ProfessionalContactUse): {
  email: string | null;
  mobile: string | null;
} {
  return {
    email:
      use.email === "professional"
        ? REGISTER_EMAIL_IN_USE_MESSAGE
        : use.email === "account"
          ? REGISTER_ACCOUNT_EXISTS_MESSAGE
          : null,
    mobile: use.mobile ? REGISTER_MOBILE_IN_USE_MESSAGE : null,
  };
}

/** Which unique contact index a 23505 error hit, if any. */
export function professionalContactUniqueViolation(
  error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined,
): "email" | "mobile" | null {
  if (!error || error.code !== "23505") return null;
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  if (text.includes("professionals_mobile_number_unique_idx")) return "mobile";
  if (text.includes("professionals_registration_email_unique_idx")) return "email";
  return null;
}
