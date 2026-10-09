/**
 * Her private notes on a visit (user, 2026-10-04): special-category health data DocCy holds
 * for her. Read only through her session or the service role; never in emails or anything
 * patient-facing. Editable only once the visit has started, on CONFIRMED rows (no-shows too).
 */
export const PROFESSIONAL_NOTES_MAX = 2000;

export const PROFESSIONAL_NOTES_HINT = "Private to you. Notes for your next visit with this patient.";

export function parseProfessionalNotes(
  raw: unknown,
): { ok: true; value: string | null; message?: undefined } | { ok: false; message: string; value?: undefined } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, message: "Notes must be text." };
  const value = raw.trim();
  if (!value) return { ok: true, value: null };
  if (value.length > PROFESSIONAL_NOTES_MAX) {
    return { ok: false, message: `Please keep notes under ${PROFESSIONAL_NOTES_MAX} characters.` };
  }
  return { ok: true, value };
}

export function professionalNotesEditRefusal(input: {
  status: string | null | undefined;
  appointmentIso: string;
  now: Date;
}): { code: "not_confirmed" | "not_started"; message: string } | null {
  if (String(input.status ?? "").trim().toUpperCase() !== "CONFIRMED") {
    return { code: "not_confirmed", message: "Notes can only be added to a confirmed visit." };
  }
  const startMs = new Date(input.appointmentIso).getTime();
  if (!Number.isFinite(startMs) || startMs > input.now.getTime()) {
    return { code: "not_started", message: "Notes can be added once the visit has started." };
  }
  return null;
}
