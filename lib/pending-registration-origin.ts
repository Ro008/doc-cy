/** Stored on professionals.directory_claim_source after a successful CONVERT. */
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
      "Registered via Claim this profile on a finder card. The finder listing stays untouched until Verify merges them.",
  },
  unclaimed: {
    label: "Unclaimed",
    description:
      "Registered via Are you a healthcare professional? Check manually whether this person already exists in the directory.",
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

export function isClaimedRegistrationOrigin(
  kind: PendingRegistrationOriginKind,
): boolean {
  return kind === "claimed";
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

/** Classify a pending registration using stored claim source only (no twin scan). */
export function classifyPendingRegistrationOrigin(input: {
  claimSource: DirectoryClaimSource | null;
}): PendingRegistrationOrigin {
  return originFromClaimSource(input.claimSource);
}

export function founderNotifySubjectForOrigin(
  kind: PendingRegistrationOriginKind,
  fullName: string,
): string {
  switch (kind) {
    case "claimed":
      return `[DocCy] Finder listing claimed — ${fullName}`;
    case "unclaimed":
      return `[DocCy] Unclaimed registration — ${fullName}`;
  }
}

export function founderNotifyNoteForOrigin(
  kind: PendingRegistrationOriginKind,
): string | null {
  switch (kind) {
    case "claimed":
      return "This person claimed their existing finder listing via Claim this profile. The finder listing is untouched until a founder Verifies — it will then merge into this registration.";
    case "unclaimed":
      return "Unclaimed registration: entered via the general healthcare professional signup. Check manually whether they already exist in the directory before verifying.";
  }
}
