/** Patient self-reported relationship to the professional (public booking). */
export function parseIsNewPatient(raw: unknown): boolean | null {
  if (raw === true || raw === "true" || raw === "new" || raw === "first") {
    return true;
  }
  if (raw === false || raw === "false" || raw === "returning") {
    return false;
  }
  return null;
}
