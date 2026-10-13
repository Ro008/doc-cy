/** Sections of the one-page public profile and their anchor tabs. */

export const PROFILE_SECTION_IDS = {
  book: "book",
  about: "about",
  services: "services",
  qualifications: "qualifications",
  reviews: "reviews",
  clinics: "clinics",
} as const;

export type ProfileSectionId = (typeof PROFILE_SECTION_IDS)[keyof typeof PROFILE_SECTION_IDS];

export type ProfileSectionTab = {
  id: ProfileSectionId;
  /** Key in the `DoctorProfilePage` messages. */
  labelKey: string;
};

export function profileSectionTabs(input: {
  hasServices: boolean;
  hasQualifications?: boolean;
  hasClinics: boolean;
  hasReviews?: boolean;
}): ProfileSectionTab[] {
  const tabs: ProfileSectionTab[] = [
    { id: PROFILE_SECTION_IDS.book, labelKey: "sectionTabBook" },
    { id: PROFILE_SECTION_IDS.about, labelKey: "sectionTabAbout" },
  ];
  if (input.hasServices) {
    tabs.push({ id: PROFILE_SECTION_IDS.services, labelKey: "sectionTabServices" });
  }
  if (input.hasQualifications) {
    tabs.push({ id: PROFILE_SECTION_IDS.qualifications, labelKey: "sectionTabQualifications" });
  }
  if (input.hasClinics) {
    tabs.push({ id: PROFILE_SECTION_IDS.clinics, labelKey: "sectionTabClinics" });
  }
  if (input.hasReviews) {
    tabs.push({ id: PROFILE_SECTION_IDS.reviews, labelKey: "sectionTabReviews" });
  }
  return tabs;
}
