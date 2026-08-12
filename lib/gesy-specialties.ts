/**
 * GeSY specialty labels for the manual directory (Excel `professionals.specialty`).
 *
 * Registration / settings use `lib/cyprus-specialties.ts`, which is built from this
 * list plus DocCy extras (e.g. Psychology) and excludes Pharmacy / Laboratory.
 */

/** Canonical labels after splitting Excel cells on `;`. */
export const GESY_MANUAL_SPECIALTIES = [
  "Accident & Emergency Medicine",
  "Allergology",
  "Anesthesiology",
  "Biochemistry",
  "Cardiology",
  "Child & Adolescent Psychiatry",
  "Clinical Dietitian",
  "Clinical Psychologist",
  "Cytology",
  "Dentist",
  "Dentoalveolar Surgery",
  "Dermato-Venereology",
  "Diagnostic Radiology",
  "Endocrinology",
  "Gastroenterology",
  "General Nurse",
  "General Surgery",
  "Geriatrics",
  "Haematology",
  "Hematology",
  "Immunology",
  "Infectious Diseases",
  "Intensive Care",
  "Internal Medicine",
  "Medical Genetic",
  "Medical Oncology",
  "Mental Health Nurse",
  "Microbiology",
  "Midwife",
  "Neonatology",
  "Neurological Surgery",
  "Neurology",
  "Nuclear Medicine",
  "Obstetrics - Gynaecology",
  "Occupational Therapist",
  "Ophthalmology",
  "Oral Surgery",
  "Orthodontics",
  "Orthopaedics",
  "Otorhinolaryngology",
  "Paediatric Cardiology",
  "Paediatric Neurology",
  "Paediatric Surgery",
  "Paediatrics",
  "Palliative Care Services",
  "Pathological Anatomy",
  "Personal Doctor",
  "Pharmacy",
  "Physical Medicine And Rehabilitation",
  "Physiotherapist",
  "Plastic Surgery",
  "Podiatrist",
  "Psychiatry",
  "Radiation Oncology",
  "Rehabilitation Services",
  "Renal Diseases",
  "Respiratory Medicine",
  "Rheumatology",
  "Speech Therapist",
  "Thoracic Surgery / Cardio Surgery",
  "Urology",
  "Vascular Surgery",
  "Oral And Maxillo-Facial Surgery",
] as const;

export type GesyManualSpecialty = (typeof GESY_MANUAL_SPECIALTIES)[number];

const GESY_SET = new Set<string>(GESY_MANUAL_SPECIALTIES as unknown as string[]);

/** Excel occasionally uses Greek Omicron in "Oral…". */
function fixSpecialtyTypos(label: string): string {
  // Greek Omicron U+039F sometimes appears instead of Latin O in "Oral…".
  return label.replace(/^\u039Fral\b/, "Oral").replace(/^Οral\b/, "Oral");
}

export function isGesyManualSpecialty(value: string): boolean {
  return GESY_SET.has(fixSpecialtyTypos(value.trim()));
}

/**
 * Split an Excel specialty cell into distinct specialties.
 * Example: "Personal Doctor; Paediatrics" → ["Personal Doctor", "Paediatrics"]
 */
export function parseGesySpecialtyCell(raw: string): string[] {
  const parts = String(raw ?? "")
    .split(";")
    .map((part) => fixSpecialtyTypos(part.trim()))
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    if (seen.has(part)) continue;
    seen.add(part);
    out.push(part);
  }
  return out;
}

export function formatGesySpecialtiesForDisplay(specialties: readonly string[]): string {
  const cleaned = specialties.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length === 0) return "Specialty not set";
  return cleaned.join(" · ");
}
