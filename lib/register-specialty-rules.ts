/** Registration checks for the specialty rows (the server still only requires non-empty). */

/** At least 3 characters and one digit: "a" or "abc" is never a licence number. */
export function isValidRegisterLicenseNumber(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.replace(/\s/g, "").length >= 3 && /\d/.test(trimmed);
}

/** "Other" specialty text: at least 3 letters, in any script. */
export function isValidRegisterCustomSpecialty(value: string): boolean {
  return (value.match(/\p{L}/gu) ?? []).length >= 3;
}
