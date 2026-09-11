import { buildDuplicateSuggestions } from "@/lib/duplicate-matching";

/** Stored on professionals.directory_claim_source after a successful CONVERT. */
export type DirectoryClaimSource =
  | "card_link"
  | "email"
  | "name_specialty_district";

/**
 * Founder-facing origin for a pending registration.
 * - claimed_listing: clicked Activate online booking (?claim=)
 * - auto_matched_listing: silent unique CONVERT (email or name+specialty+district)
 * - possible_twin: INSERT + similar unregistered listing(s) still alive
 * - unclaimed_review: INSERT with no clear listing match (may be truly new)
 */
export type PendingRegistrationOriginKind =
  | "claimed_listing"
  | "auto_matched_listing"
  | "possible_twin"
  | "unclaimed_review";

export type PendingTwinCandidate = {
  id: string;
  name: string;
  specialty: string | null;
  district: string | null;
  slug: string | null;
  score: number;
  reason: string;
};

export type PendingRegistrationOrigin = {
  kind: PendingRegistrationOriginKind;
  label: string;
  description: string;
  claimSource: DirectoryClaimSource | null;
  twins: PendingTwinCandidate[];
};

const LABELS: Record<
  PendingRegistrationOriginKind,
  { label: string; description: string }
> = {
  claimed_listing: {
    label: "Claimed listing",
    description:
      "Registered via Activate online booking on a finder card (same professional id).",
  },
  auto_matched_listing: {
    label: "Auto-matched listing",
    description:
      "Signup converted an existing finder listing automatically (email or name + specialty + district).",
  },
  possible_twin: {
    label: "Possible twin",
    description:
      "Registered without claiming a listing, but a similar unregistered finder profile still exists.",
  },
  unclaimed_review: {
    label: "Unclaimed — review",
    description:
      "Registered without claiming a listing, and no clear finder match was found. May be new — or a missed twin.",
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
): Pick<PendingRegistrationOrigin, "kind" | "label" | "description" | "claimSource"> {
  if (claimSource === "card_link") {
    return {
      kind: "claimed_listing",
      claimSource,
      ...LABELS.claimed_listing,
    };
  }
  if (claimSource === "email" || claimSource === "name_specialty_district") {
    return {
      kind: "auto_matched_listing",
      claimSource,
      ...LABELS.auto_matched_listing,
    };
  }
  return {
    kind: "unclaimed_review",
    claimSource: null,
    ...LABELS.unclaimed_review,
  };
}

type TwinMatchInput = {
  doctorId: string;
  name: string;
  specialty: string | null;
  district: string | null;
};

type UnregisteredListing = {
  id: string;
  name: string;
  specialty: string | null;
  district: string | null;
  slug?: string | null;
};

/**
 * Classify a pending registration using stored claim source + live twin scan.
 * Claimed / auto-matched never become twins (CONVERT already absorbed the listing).
 */
export function classifyPendingRegistrationOrigin(input: {
  claimSource: DirectoryClaimSource | null;
  doctor: TwinMatchInput;
  unregisteredListings: readonly UnregisteredListing[];
  /** Pairs already dismissed (Keep both) — do not surface again. */
  dismissedUnregisteredIds?: ReadonlySet<string>;
}): PendingRegistrationOrigin {
  const base = originFromClaimSource(input.claimSource);
  if (base.kind === "claimed_listing" || base.kind === "auto_matched_listing") {
    return { ...base, twins: [] };
  }

  const dismissed = input.dismissedUnregisteredIds ?? new Set<string>();
  const manuals = input.unregisteredListings.filter((row) => !dismissed.has(row.id));
  const suggestions = buildDuplicateSuggestions(manuals, [
    {
      id: input.doctor.doctorId,
      name: input.doctor.name,
      specialty: input.doctor.specialty,
      district: input.doctor.district,
    },
  ]);

  const twins: PendingTwinCandidate[] = suggestions
    .filter((s) => s.doctorId === input.doctor.doctorId)
    .map((s) => {
      const listing = manuals.find((m) => m.id === s.manualId);
      return {
        id: s.manualId,
        name: listing?.name ?? "Listing",
        specialty: listing?.specialty ?? null,
        district: listing?.district ?? null,
        slug: listing?.slug?.trim() || null,
        score: s.score,
        reason: s.reason,
      };
    });

  if (twins.length === 0) {
    return { ...LABELS.unclaimed_review, kind: "unclaimed_review", claimSource: null, twins: [] };
  }

  return {
    kind: "possible_twin",
    claimSource: null,
    ...LABELS.possible_twin,
    twins,
  };
}

export function founderNotifySubjectForOrigin(
  kind: PendingRegistrationOriginKind,
  fullName: string,
): string {
  switch (kind) {
    case "claimed_listing":
      return `[DocCy] Finder listing claimed — ${fullName}`;
    case "auto_matched_listing":
      return `[DocCy] Auto-matched listing — ${fullName}`;
    case "possible_twin":
      return `[DocCy] Possible twin — ${fullName}`;
    case "unclaimed_review":
      return `[DocCy] Unclaimed registration — ${fullName}`;
  }
}

export function founderNotifyNoteForOrigin(
  kind: PendingRegistrationOriginKind,
): string | null {
  switch (kind) {
    case "claimed_listing":
      return "This person claimed their existing finder listing via Activate online booking (same professional id). Pending verification — patients keep the same public profile.";
    case "auto_matched_listing":
      return "Signup auto-matched and converted an existing finder listing (email or name + specialty + district). Pending verification — patients keep the same public profile.";
    case "possible_twin":
      return "Possible twin: a similar unregistered finder listing still exists. Review Absorb vs Keep both in pending registration review.";
    case "unclaimed_review":
      return "Unclaimed — review: registered without claiming a listing, and no clear finder match was found. May be truly new, or a missed twin.";
  }
}
