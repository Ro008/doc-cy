/** Full signup payload for founder review of pending professionals. */

import type {
  DirectoryClaimSource,
  PendingRegistrationOriginKind,
  PendingTwinCandidate,
} from "@/lib/pending-registration-origin";

export type PendingRegistrationSpecialty = {
  id: string | null;
  specialty: string;
  licenseNumber: string | null;
  isApproved: boolean;
};

export type PendingRegistrationLocation = {
  id: string | null;
  district: string | null;
  town: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  isPrimary: boolean;
};

export type PendingRegistrationReviewItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  slug: string | null;
  avatarUrl: string | null;
  languages: string[];
  specialties: PendingRegistrationSpecialty[];
  /** Legacy single specialty on the professional row when junction rows are missing. */
  primarySpecialty: string | null;
  primaryLicenseNumber: string | null;
  locations: PendingRegistrationLocation[];
  licenseFileUrl: string | null;
  createdAt: string | null;
  isSpecialtyApproved: boolean;
  specialtyRequiresStandardAt: string | null;
  /** @deprecated Prefer originKind — kept for older call sites. */
  fromDirectoryListing: boolean;
  originKind: PendingRegistrationOriginKind;
  originLabel: string;
  originDescription: string;
  claimSource: DirectoryClaimSource | null;
  twins: PendingTwinCandidate[];
  status: string;
};

export function formatPendingRegistrationNotifyLines(
  item: Pick<
    PendingRegistrationReviewItem,
    | "name"
    | "email"
    | "phone"
    | "languages"
    | "specialties"
    | "primarySpecialty"
    | "primaryLicenseNumber"
    | "locations"
    | "fromDirectoryListing"
    | "avatarUrl"
  > &
    Partial<Pick<PendingRegistrationReviewItem, "originKind" | "originLabel">>,
): string[] {
  const specialtyLines =
    item.specialties.length > 0
      ? item.specialties.map((s) => {
          const license = s.licenseNumber?.trim() || "—";
          const flag = s.isApproved ? "approved" : "needs specialty review";
          return `  - ${s.specialty} (license ${license}, ${flag})`;
        })
      : [
          `  - ${item.primarySpecialty?.trim() || "—"} (license ${item.primaryLicenseNumber?.trim() || "—"})`,
        ];

  const locationLines =
    item.locations.length > 0
      ? item.locations.map((loc, index) => {
          const parts = [
            loc.address?.trim(),
            loc.town?.trim(),
            loc.district?.trim(),
          ].filter(Boolean);
          const label = loc.isPrimary
            ? "Primary clinic"
            : `Clinic ${index + 1}`;
          const coords =
            typeof loc.latitude === "number" &&
            typeof loc.longitude === "number" &&
            Number.isFinite(loc.latitude) &&
            Number.isFinite(loc.longitude)
              ? ` (${loc.latitude}, ${loc.longitude})`
              : "";
          return `  - ${label}: ${parts.join(", ") || "—"}${coords}`;
        })
      : ["  - —"];

  const originNote =
    item.originLabel?.trim() ||
    (item.fromDirectoryListing ? "Claimed listing" : null);

  return [
    `Name: ${item.name}`,
    `Email: ${item.email?.trim() || "—"}`,
    `Phone: ${item.phone?.trim() || "—"}`,
    `Photo uploaded: ${item.avatarUrl ? "yes" : "no"}`,
    `Languages: ${item.languages.length ? item.languages.join(", ") : "—"}`,
    `Specialties:`,
    ...specialtyLines,
    `Clinic locations:`,
    ...locationLines,
    originNote ? `Registration origin: ${originNote}` : null,
  ].filter((line): line is string => Boolean(line));
}
