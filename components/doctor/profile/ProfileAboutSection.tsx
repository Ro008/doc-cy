import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { patientAgesMessageKey } from "@/lib/public/profile-public-details";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";
import type { PatientAges } from "@/lib/settings-profile-details";

type Props = {
  firstName: string;
  bio: string | null;
  /** "Patients I see" from Settings › Profile; null when she has not chosen. */
  patientAges: PatientAges | null;
};

/**
 * "About": the bio, open (no accordion), then who she sees (adults, children or both).
 * Languages are in the hero.
 */
export async function ProfileAboutSection({ firstName, bio, patientAges }: Props) {
  const t = await getTranslations("DoctorProfilePage");
  const bioText = (bio ?? "").trim();
  const patientsKey = patientAgesMessageKey(patientAges);

  return (
    <section
      id={PROFILE_SECTION_IDS.about}
      aria-labelledby="profile-about-heading"
      className="grid scroll-mt-20 gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8"
    >
      <h2
        id="profile-about-heading"
        className="text-2xl font-extrabold tracking-tight text-profile-text sm:text-[28px]"
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
            className="inline-flex items-center gap-2.5 self-start rounded-2xl border border-profile-border bg-profile-surface px-4 py-2.5"
          >
            <Users className="h-5 w-5 shrink-0 text-accent-link" aria-hidden />
            <span className="text-sm text-profile-muted">{t("patientsSeenLabel")}</span>
            <span className="font-semibold text-profile-text">{t(patientsKey)}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
