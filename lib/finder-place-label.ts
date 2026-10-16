/**
 * What the Finder's "District or town" picker says (Finder G, step 2): Near me, the town
 * with its district, the district, or All of Cyprus.
 */
export function finderPlaceLabel(input: {
  district: string;
  town: string;
  nearMe: boolean;
}): string {
  if (input.nearMe) return "Near me";
  const district = input.district.trim();
  const town = input.town.trim();
  if (town && district && town !== district) return `${town}, ${district}`;
  return town || district || "All of Cyprus";
}
