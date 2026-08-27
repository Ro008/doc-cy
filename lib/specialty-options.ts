/**
 * Master specialties shown in a combobox, minus ones already used on other rows.
 * The current row's selection stays available even if listed in `exclude`.
 */
export function filterAvailableMasterSpecialties(
  masters: readonly string[],
  exclude: readonly string[],
  keepSelected?: string | null,
): string[] {
  const excluded = new Set(
    exclude.map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  const keep = String(keepSelected ?? "").trim().toLowerCase();
  if (keep) excluded.delete(keep);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of masters) {
    const key = label.trim().toLowerCase();
    if (!key || excluded.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/** True when two or more non-empty specialty labels collide (case-insensitive). */
export function hasDuplicateSpecialtyLabels(
  labels: readonly string[],
): boolean {
  const seen = new Set<string>();
  for (const label of labels) {
    const key = label.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}
