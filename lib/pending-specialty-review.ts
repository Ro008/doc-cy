/**
 * Founder review queue for custom ("Other") specialties.
 *
 * `professionals.specialty` only holds the denormalized primary label, so a doctor
 * who registered `Psychology` + a custom `Sexologist` shows up as "Psychology".
 * The reviewable unit is a `doctor_specialties` row, not the professional.
 */

export type PendingSpecialtyProfessional = {
  id: string;
  name: string | null;
  email: string | null;
  specialty: string | null;
};

export type PendingSpecialtyJunctionRow = {
  id: string;
  doctor_id: string;
  specialty: string | null;
  license_number: string | null;
  is_approved: boolean | null;
};

export type PendingSpecialtyItem = {
  /** professionals.id */
  id: string;
  /** doctor_specialties.id — null when the junction row is missing (older rows). */
  specialtyId: string | null;
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
    const list = byDoctor.get(row.doctor_id);
    if (list) list.push(row);
    else byDoctor.set(row.doctor_id, [row]);
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

    if (pending.length === 0) {
      items.push({
        id: professional.id,
        specialtyId: null,
        name,
        email: professional.email ?? null,
        specialty: cleanLabel(professional.specialty) || null,
        licenseNumber: null,
        approvedSpecialties,
        hasOtherSpecialties: false,
      });
      continue;
    }

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
