/**
 * Stored on professionals.directory_claim_source by the old registration path (before
 * the request-based registration, #231); shown as a badge in the founders' list.
 */
export type DirectoryClaimSource =
  | "card_link"
  | "email"
  | "name_specialty_district";

/** Founder-facing origin badge: Claimed vs Unclaimed. */
export type PendingRegistrationOriginKind = "claimed" | "unclaimed";

export type PendingRegistrationOrigin = {
  kind: PendingRegistrationOriginKind;
  label: string;
  description: string;
  claimSource: DirectoryClaimSource | null;
};

const LABELS: Record<
  PendingRegistrationOriginKind,
  { label: string; description: string }
> = {
  claimed: {
    label: "Claimed",
    description:
      "Registered via Claim this profile on a finder card (old registration path).",
  },
  unclaimed: {
    label: "Unclaimed",
    description:
      "Registered via the general professional sign-up (old registration path).",
  },
};

export function isDirectoryClaimSource(
  value: string | null | undefined,
): value is DirectoryClaimSource {
  return (
    value === "card_link" ||
    value === "email" ||
    value === "name_specialty_district"
  );
}

export function parseDirectoryClaimSource(
  value: string | null | undefined,
): DirectoryClaimSource | null {
  const raw = String(value ?? "").trim();
  return isDirectoryClaimSource(raw) ? raw : null;
}

export function originFromClaimSource(
  claimSource: DirectoryClaimSource | null,
): PendingRegistrationOrigin {
  if (claimSource === "card_link") {
    return {
      kind: "claimed",
      claimSource,
      ...LABELS.claimed,
    };
  }
  return {
    kind: "unclaimed",
    claimSource: claimSource ?? null,
    ...LABELS.unclaimed,
  };
}
