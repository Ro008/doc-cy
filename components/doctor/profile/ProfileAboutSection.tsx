import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";
import { patientAgesMessageKey } from "@/lib/public/profile-public-details";
import type { PatientAges } from "@/lib/settings-profile-details";

type Props = {
  firstName: string;
  bio: string | null;
  /** Her "Patients I see" from Settings › Profile; null when she has not chosen. */
  patientAges: PatientAges | null;
};

/**
 * "About": the bio, open (no accordion), then the patients she sees as one line under it
 * (user, 2026-10-14: too little for a section of its own). Languages are in the hero.
 */
export async function ProfileAboutSection({ firstName, bio, patientAges }: Props) {
  const t = await getTranslations("DoctorProfilePage");
  const bioText = (bio ?? "").trim();
  const patientsKey = patientAgesMessageKey(patientAges);

  return (
    <section
      id={PROFILE_SECTION_IDS.about}
      aria-labelledby="profile-about-heading"
      className="grid scroll-mt-20 gap-5"
    >
      <h2
        id="profile-about-heading"
        className="text-2xl font-semibold tracking-tight text-profile-text sm:text-[28px]"
      >
        {t("aboutHeading", { name: firstName })}
      </h2>
      <div className="flex flex-col gap-4">
        <p
          className={`max-w-prose whitespace-pre-wrap text-base leading-relaxed sm:text-[17px] ${
            bioText ? "text-profile-body" : "text-profile-muted"
          }`}
        >
          {bioText || t("aboutEmpty")}
        </p>
        {patientsKey ? (
          <p
            data-testid="profile-patients-seen"
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base sm:text-[17px]"
          >
            <Users className="h-5 w-5 shrink-0 text-accent-link" aria-hidden />
            <span className="text-profile-muted">{t("patientsSeenHeading")}:</span>
            <span className="font-semibold text-profile-text">{t(patientsKey)}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
