import { FINDER_CLINIC_HERO_ILLUSTRATION } from "@/lib/finder-default-avatars";

/** Decorative finder / marketing heroes. Hidden on small screens via `sizes`. */
export const FINDER_PROFESSIONALS_HERO_SRC = "/finder/finder-hero.webp";
export const FINDER_CLINICS_HERO_SRC = "/finder/clinics-hero.webp";
export const LANDING_HERO_DOCTOR_SRC = "/landing/hero-doctor.webp";

/** Old PNG paths kept as 308 targets so cached OG / bookmarks still resolve. */
export const FINDER_HERO_PNG_REDIRECTS = [
  { source: "/finder/finder-hero.png", destination: FINDER_PROFESSIONALS_HERO_SRC },
  { source: "/finder/clinics-hero.png", destination: FINDER_CLINICS_HERO_SRC },
  { source: "/finder/avatars/clinic-hero.png", destination: FINDER_CLINIC_HERO_ILLUSTRATION },
  { source: "/landing/hero-doctor.png", destination: LANDING_HERO_DOCTOR_SRC },
] as const;
