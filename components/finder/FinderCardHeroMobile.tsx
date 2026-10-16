import { RevealMobileButton } from "@/components/doctor/profile/RevealMobileButton";
import { loadFinderPersonalMobileIds } from "@/lib/public/load-finder-personal-mobiles";

/**
 * Show mobile in the card's hero (mockup L), as on her profile: only for a professional who
 * shows her mobile there. The number is fetched on the click and recorded in user_events
 * (`show_personal_mobile_number`, source `registered_professional_finder_card`).
 */
export async function FinderCardHeroMobile({
  professionalId,
  doctorIdsKey,
}: {
  professionalId: string;
  doctorIdsKey: string;
}) {
  const mobileIds = await loadFinderPersonalMobileIds(doctorIdsKey);
  if (!mobileIds.has(professionalId)) return null;
  return (
    <RevealMobileButton
      professionalId={professionalId}
      source="finder_card"
      label="Show mobile"
      loadingLabel="Loading…"
      errorLabel="Could not load the number"
      className="font-bold text-accent-link underline decoration-1 underline-offset-4 transition-none hover:decoration-2"
      testId="finder-card-mobile"
    />
  );
}
