import { MAX_FOUNDERS, type FoundersAvailability } from "@/lib/founders-club";

export type RegisterPlanTicketCell = {
  kicker: string;
  price: string;
  detail: string;
};

export type RegisterPlanTicket = {
  profile: RegisterPlanTicketCell;
  booking: RegisterPlanTicketCell;
  then: RegisterPlanTicketCell & {
    /** Official price, shown struck through as "instead of …" while the launch offer is open. */
    wasPrice: string | null;
    /** "17 spots left", only while the launch offer is open. */
    spots: string | null;
    /** How full the Founding Members Club is (0–100), for the progress bar. */
    spotsTakenPercent: number | null;
    vatNote: string;
  };
};

const STANDARD_PRICE = "€49/mo";

/**
 * The /register price ticket: free profile, 6 free months, then the launch
 * offer (Founding Members, first 50 practices) or the standard price once full.
 */
export function registerPlanTicket(
  availability: Pick<FoundersAvailability, "offerAvailable" | "spotsRemaining">,
): RegisterPlanTicket {
  const spotsRemaining = Math.max(0, Math.min(MAX_FOUNDERS, availability.spotsRemaining));
  const founders = availability.offerAvailable && spotsRemaining > 0;
  return {
    profile: { kicker: "PUBLIC PROFILE", price: "Free", detail: "Forever, no listing fee" },
    booking: { kicker: "ONLINE BOOKING", price: "6 months free", detail: "No credit card" },
    then: founders
      ? {
          kicker: "LAUNCH OFFER · FOUNDING MEMBERS",
          price: "€19/mo",
          wasPrice: STANDARD_PRICE,
          detail: `For the first ${MAX_FOUNDERS} practices · locked for life`,
          spots: `${spotsRemaining} ${spotsRemaining === 1 ? "spot" : "spots"} left`,
          spotsTakenPercent: Math.round(((MAX_FOUNDERS - spotsRemaining) / MAX_FOUNDERS) * 100),
          vatNote: "+VAT, if applicable",
        }
      : {
          kicker: "THEN",
          price: STANDARD_PRICE,
          wasPrice: null,
          detail: "Standard pricing · cancel anytime",
          spots: null,
          spotsTakenPercent: null,
          vatNote: "+VAT, if applicable",
        },
  };
}
