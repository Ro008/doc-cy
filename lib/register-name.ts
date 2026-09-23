/**
 * First / last name on /register: at least one letter (any script), no digits.
 * Spaces, hyphens and apostrophes are fine (Anne-Marie, O'Brien, Van der Berg).
 * Written for the `v`/`u` flag browsers apply to `pattern`.
 */
export const REGISTER_NAME_HTML_PATTERN = "[^0-9]*\\p{L}[^0-9]*";

const REGISTER_NAME_RE = new RegExp(`^(?:${REGISTER_NAME_HTML_PATTERN})$`, "u");

export function isValidRegisterName(name: string): boolean {
  return REGISTER_NAME_RE.test(name);
}
