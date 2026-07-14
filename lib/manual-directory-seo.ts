import { harmonizeFinderSpecialtyLabel } from "@/lib/finder-specialty-harmonize";

/** Shorter specialty label for manual directory SEO titles. */
export function getManualDirectorySpecialtySeoLabel(specialty: string): string {
  const harmonized = harmonizeFinderSpecialtyLabel(specialty);
  if (harmonized === "Physiotherapy & Rehabilitation") return "Physiotherapy";
  return harmonized || specialty.trim() || "Healthcare";
}

export function buildManualDirectorySeoTitle(input: {
  name: string;
  specialty: string;
  district: string;
}): string {
  const specialtyLabel = getManualDirectorySpecialtySeoLabel(input.specialty);
  return `${input.name.trim()} — ${specialtyLabel} in ${input.district.trim()} | DocCy`;
}

export function buildManualDirectorySeoDescription(input: {
  name: string;
  specialty: string;
  district: string;
  phone?: string | null;
}): string {
  const specialtyLabel = getManualDirectorySpecialtySeoLabel(input.specialty);
  const base = `Find ${input.name.trim()}, a ${specialtyLabel.toLowerCase()} professional in ${input.district.trim()}, Cyprus on DocCy. View contact details and request an appointment.`;
  const phone = String(input.phone ?? "").trim();
  if (!phone) return base;
  return `${base} Clinic phone: ${phone}.`;
}
