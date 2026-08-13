export function finderAvailabilityRequestKey(doctorIds: readonly string[]): string {
  return Array.from(new Set(doctorIds.filter(Boolean))).sort().join(",");
}
