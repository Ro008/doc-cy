/** Shared password rules for practitioner register and reset. */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

/** HTML `pattern`: 8–200 chars with upper, lower, digit, and a non-alphanumeric. */
export const PASSWORD_POLICY_HTML_PATTERN =
  "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,200}";

export const PASSWORD_POLICY_HELPER =
  "Use at least 8 characters, including uppercase, lowercase, a number, and a special character.";

export const PASSWORD_POLICY_ERROR =
  "Enter at least 8 characters, including uppercase, lowercase, a number, and a special character.";

export const PASSWORD_POLICY_TITLE = PASSWORD_POLICY_HELPER;

const HAS_LOWER = /[a-z]/;
const HAS_UPPER = /[A-Z]/;
const HAS_DIGIT = /[0-9]/;
const HAS_SPECIAL = /[^A-Za-z0-9]/;

export function isStrongPassword(value: string): boolean {
  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    return false;
  }
  return (
    HAS_LOWER.test(value) &&
    HAS_UPPER.test(value) &&
    HAS_DIGIT.test(value) &&
    HAS_SPECIAL.test(value)
  );
}
