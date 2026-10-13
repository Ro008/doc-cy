/**
 * Profile tab additions (user, 2026-10-10): the name changes by request (founders
 * verified it at registration), "who you see" is one of three choices, and
 * qualifications are a short list. What the form checks before it sends anything; the
 * backend checks again (docs/handoff/settings-redesign.md).
 */

const collapse = (value: string) => value.trim().replace(/\s+/g, " ");

export type NameChangeCheck = { ok: true; name: string } | { ok: false; message: string };

const NAME_MAX = 80;
const TITLE_PATTERN = /^(dr|doctor|prof|professor|mr|mrs|ms|miss)\.?\s/i;

/** The name she asks DocCy to show instead of `current`. */
export function validateNameChangeRequest(current: string, requested: string): NameChangeCheck {
  const name = collapse(requested);
  // First: the field opens on the current name, whatever characters that has.
  if (name && name.toLocaleLowerCase() === collapse(current).toLocaleLowerCase()) {
    return { ok: false, message: "That is already your name on DocCy." };
  }
  if (name.split(" ").filter(Boolean).length < 2) {
    return { ok: false, message: "Enter your first name and surname." };
  }
  if (TITLE_PATTERN.test(name)) return { ok: false, message: "Leave out titles such as Dr or Prof." };
  if (!/^[\p{L}\p{M}' ’.-]+$/u.test(name)) {
    return { ok: false, message: "Use letters, spaces, hyphens and apostrophes only." };
  }
  if (name.length > NAME_MAX) return { ok: false, message: `Keep the name under ${NAME_MAX} characters.` };
  return { ok: true, name };
}

export type PatientAges = "adults" | "children" | "all";

export const PATIENT_AGE_OPTIONS: ReadonlyArray<{ value: PatientAges; label: string }> = [
  { value: "adults", label: "Adults" },
  { value: "children", label: "Children" },
  { value: "all", label: "Adults and children" },
];

export const MAX_QUALIFICATIONS = 6;
const QUALIFICATION_FIRST_YEAR = 1950;

export type Qualification = { title: string; institution: string; year: number | null };
export type QualificationErrors = { title?: string; institution?: string; year?: string };
export type QualificationCheck =
  | { ok: true; qualification: Qualification }
  | { ok: false; errors: QualificationErrors };

/** One line of the qualifications list, as typed ("year" may be empty). */
export function validateQualification(
  typed: { title: string; institution: string; year: string },
  thisYear: number = new Date().getFullYear(),
): QualificationCheck {
  const title = collapse(typed.title);
  const institution = collapse(typed.institution);
  const yearText = typed.year.trim();
  const errors: QualificationErrors = {};

  if (!title) errors.title = "Enter the qualification.";
  else if (title.length > 80) errors.title = "Keep the qualification under 80 characters.";

  if (!institution) errors.institution = "Enter where you obtained it.";
  else if (institution.length > 100) errors.institution = "Keep the institution under 100 characters.";

  let year: number | null = null;
  if (yearText) {
    year = /^\d{4}$/.test(yearText) ? Number(yearText) : NaN;
    if (!(year >= QUALIFICATION_FIRST_YEAR && year <= thisYear)) {
      errors.year = `Enter a year between ${QUALIFICATION_FIRST_YEAR} and ${thisYear}.`;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, qualification: { title, institution, year } };
}

/** The saved "patients I see" (`professionals.patients_seen`), or null when not chosen. */
export function parsePatientAges(value: unknown): PatientAges | null {
  return PATIENT_AGE_OPTIONS.some((option) => option.value === value) ? (value as PatientAges) : null;
}

export type SavedQualification = Qualification & { id: string };

/** The saved list (`professionals.qualifications`), without lines that cannot be shown. */
export function parseSavedQualifications(value: unknown): SavedQualification[] {
  if (!Array.isArray(value)) return [];
  const list: SavedQualification[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const { id, title, institution, year } = row as Record<string, unknown>;
    if (typeof id !== "string" || !id || typeof title !== "string" || !title.trim()) continue;
    list.push({
      id,
      title,
      institution: typeof institution === "string" ? institution : "",
      year: typeof year === "number" && Number.isInteger(year) ? year : null,
    });
  }
  return list;
}

/** A qualification as the API receives it: the year is a number, text or missing. */
export function qualificationFromBody(body: unknown, thisYear: number = new Date().getFullYear()): QualificationCheck {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  return validateQualification(
    {
      title: typeof b.title === "string" ? b.title : "",
      institution: typeof b.institution === "string" ? b.institution : "",
      year: b.year === null || b.year === undefined ? "" : String(b.year),
    },
    thisYear,
  );
}
