import { GraduationCap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { qualificationDetail } from "@/lib/public/profile-public-details";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";
import type { SavedQualification } from "@/lib/settings-profile-details";

/**
 * "Qualifications": the list she keeps in Settings › Profile, in her order. DocCy does not
 * check them. Hidden when she has none.
 */
export async function ProfileQualificationsSection({
  qualifications,
}: {
  qualifications: readonly SavedQualification[];
}) {
  if (qualifications.length === 0) return null;
  const t = await getTranslations("DoctorProfilePage");

  return (
    <section
      id={PROFILE_SECTION_IDS.qualifications}
      aria-labelledby="profile-qualifications-heading"
      className="grid scroll-mt-20 gap-5"
    >
      <h2
        id="profile-qualifications-heading"
        className="text-2xl font-extrabold tracking-tight text-profile-text sm:text-[28px]"
      >
        {t("qualificationsHeading")}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {qualifications.map((qualification) => {
          const detail = qualificationDetail(qualification);
          return (
            <li
              key={qualification.id}
              data-testid="profile-qualification"
              className="flex items-start gap-3 rounded-2xl border border-profile-border bg-profile-surface px-5 py-4"
            >
              <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-accent-link" aria-hidden />
              <span className="min-w-0">
                <span className="block break-words font-semibold text-profile-text">{qualification.title}</span>
                {detail ? (
                  <span className="mt-0.5 block break-words text-sm text-profile-muted">{detail}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
