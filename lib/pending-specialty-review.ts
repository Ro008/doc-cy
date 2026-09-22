/**
 * Founder review queue for custom ("Other") specialties.
 *
 * The reviewable unit is a `professional_specialties` row, not the professional:
 * a professional who registered `Psychology` + a custom `Sexologist` is reviewed
 * for `Sexologist` only.
 */

export type PendingSpecialtyProfessional = {
  id: string;
  name: string | null;
  email: string | null;
};

export type PendingSpecialtyJunctionRow = {
  id: string;
  professional_id: string;
  specialty: string | null;
  license_number: string | null;
  is_approved: boolean | null;
};

export type PendingSpecialtyItem = {
  /** professionals.id */
  id: string;
  /** professional_specialties.id of the pending row. */
  specialtyId: string;
  name: string;
  email: string | null;
  specialty: string | null;
  licenseNumber: string | null;
  /** Already-approved specialties for the same professional. */
  approvedSpecialties: string[];
  /** Removing this one still leaves the professional with another specialty. */
  hasOtherSpecialties: boolean;
};

function cleanLabel(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

export function buildPendingSpecialtyItems(
  professionals: readonly PendingSpecialtyProfessional[],
  specialtyRows: readonly PendingSpecialtyJunctionRow[],
): PendingSpecialtyItem[] {
  const byDoctor = new Map<string, PendingSpecialtyJunctionRow[]>();
  for (const row of specialtyRows) {
    const list = byDoctor.get(row.professional_id);
    if (list) list.push(row);
    else byDoctor.set(row.professional_id, [row]);
  }

  const items: PendingSpecialtyItem[] = [];

  for (const professional of professionals) {
    const rows = byDoctor.get(professional.id) ?? [];
    const approvedSpecialties = rows
      .filter((row) => row.is_approved === true)
      .map((row) => cleanLabel(row.specialty))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    const pending = rows.filter((row) => row.is_approved === false);
    const name = cleanLabel(professional.name) || "—";

    for (const row of pending) {
      items.push({
        id: professional.id,
        specialtyId: row.id,
        name,
        email: professional.email ?? null,
        specialty: cleanLabel(row.specialty) || null,
        licenseNumber: cleanLabel(row.license_number) || null,
        approvedSpecialties,
        hasOtherSpecialties: rows.length > 1,
      });
    }
  }

  return items;
}
