/**
 * Strip GeSY Excel name pollution that is not part of the person display name:
 * role notes ((Resident Doctor), specialisation clauses), clinic/brand suffixes.
 * Does NOT strip short nickname aliases like "Charalambos (Charis) …".
 */

/**
 * @param {string} raw
 * @returns {string}
 */
export function cleanGesyDirectoryDisplayName(raw) {
  let name = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return name;

  // (Resident Doctor) — missing space before "(" and extra trailing ")" also appear.
  name = name.replace(/\s*\(\s*Resident\s+Doctor\s*\)+/gi, "").trim();

  // Clinical / role notes in trailing parentheses.
  name = name
    .replace(/\s*\(\s*Doctor\s+With\s+Specialis[ae]tion\b[^)]*\)\s*$/i, "")
    .replace(/\s*\(\s*Doctor\s+Without\b[^)]*\)\s*$/i, "")
    .replace(/\s*\(\s*Only\s+For\b[^)]*\)\s*$/i, "")
    .trim();

  // Clinic / org brand inside trailing parentheses (EN or Greek).
  name = name
    .replace(
      /\s*\([^)]*(?:clinic|centre|center|hospital|practice|κεντρο|κέντρο|λογοθερ)[^)]*\)\s*$/iu,
      "",
    )
    .trim();

  // Brand clause after " - " (e.g. "Elena Troullidou - Mydietspot … Center").
  if (/\s+-\s+.+\b(?:center|centre|clinic|hospital|practice|health|weight|spot)\b/i.test(name)) {
    name = name.replace(/\s+-\s+.+$/u, "").trim();
  }

  return name.replace(/\s+/g, " ").replace(/[,\s]+$/u, "").trim();
}
