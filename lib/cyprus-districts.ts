export const CYPRUS_DISTRICTS = [
  "Nicosia",
  "Limassol",
  "Paphos",
  "Larnaca",
  "Famagusta",
] as const;

export type CyprusDistrict = (typeof CYPRUS_DISTRICTS)[number];

export function isCyprusDistrict(value: string): value is CyprusDistrict {
  return (CYPRUS_DISTRICTS as readonly string[]).includes(value);
}
