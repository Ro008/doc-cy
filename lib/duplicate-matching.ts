type ManualDirectoryCandidate = {
  id: string;
  name: string;
  specialty: string | null;
  district: string | null;
};

type RegisteredDoctorCandidate = {
  id: string;
  name: string;
  specialty: string | null;
  district: string | null;
};

export type DuplicateSuggestionCandidate = {
  manualId: string;
  doctorId: string;
  score: number;
  reason: string;
};

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(dr|doctor|md|prof)\b\.?/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenSet(value: string): Set<string> {
  return new Set(value.split(" ").filter(Boolean));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of Array.from(a)) {
    if (b.has(token)) intersection += 1;
  }
  const union = new Set([...Array.from(a), ...Array.from(b)]).size;
  return union === 0 ? 0 : intersection / union;
}

export function buildDuplicateSuggestions(
  manualRows: ManualDirectoryCandidate[],
  doctors: RegisteredDoctorCandidate[]
): DuplicateSuggestionCandidate[] {
  const out: DuplicateSuggestionCandidate[] = [];

  for (const manual of manualRows) {
    const normalizedManualName = normalizeText(manual.name);
    const manualTokens = tokenSet(normalizedManualName);
    const manualSpecialty = normalizeText(manual.specialty);
    const manualDistrict = normalizeText(manual.district);

    for (const doctor of doctors) {
      const normalizedDoctorName = normalizeText(doctor.name);
      const doctorTokens = tokenSet(normalizedDoctorName);
      const doctorSpecialty = normalizeText(doctor.specialty);
      const doctorDistrict = normalizeText(doctor.district);

      const nameScore =
        normalizedManualName === normalizedDoctorName
          ? 1
          : jaccardSimilarity(manualTokens, doctorTokens);
      const specialtyScore =
        manualSpecialty && doctorSpecialty && manualSpecialty === doctorSpecialty ? 1 : 0;
      const districtScore =
        manualDistrict && doctorDistrict && manualDistrict === doctorDistrict ? 1 : 0;

      const score = Number((nameScore * 0.7 + specialtyScore * 0.2 + districtScore * 0.1).toFixed(4));

      if (score < 0.85) continue;

      const reasonBits = [
        `Name match ${(nameScore * 100).toFixed(0)}%`,
        specialtyScore > 0 ? "same specialty" : "specialty differs",
        districtScore > 0 ? "same district" : "district differs/unknown",
      ];

      out.push({
        manualId: manual.id,
        doctorId: doctor.id,
        score,
        reason: reasonBits.join(" · "),
      });
    }
  }

  return out.sort((a, b) => b.score - a.score);
}
