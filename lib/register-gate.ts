import type { AccountKind } from "@/lib/account-summary";
import type { ReapplyState } from "@/lib/registration-reapply";

/**
 * A professional who already has a profile can't register again or claim another
 * listing (bug, 2026-09-29). Type-only imports: listing cards (client) use
 * `canClaimListing`.
 */

export type RegisterPageGate = "form" | "status" | "has_profile";

/** What /register shows a visitor, from `reapplyStateForUser` (null when signed out). */
export function registerPageGate(state: ReapplyState | null): RegisterPageGate {
  if (state?.kind === "pending") return "status";
  if (state?.kind === "professional") return "has_profile";
  return "form";
}

/** Listing cards offer "Claim this Profile" to everyone but a signed-in professional. */
export function canClaimListing(accountKind: AccountKind | null): boolean {
  return accountKind !== "professional";
}

/** Prefilled support message: a listing that may be hers too gets merged by the founders. */
export function alreadyHasProfileSupportMessage(listingName: string | null | undefined): string {
  const name = String(listingName ?? "").trim();
  return [
    "I already have a DocCy profile.",
    name
      ? `The directory listing "${name}" is also me. Please merge it into my profile.`
      : "I found another directory listing that is also me. Please merge it into my profile.",
    "",
    "Listing link (if not above):",
    "",
  ].join("\n");
}
