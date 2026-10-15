import { GraduationCap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ProfileHeadingIcon } from "@/components/doctor/profile/ProfileHeadingIcon";
import { ProfileShowAll } from "@/components/doctor/profile/ProfileShowAll";
import { qualificationsNewestFirst } from "@/lib/public/profile-public-details";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";
import type { SavedQualification } from "@/lib/settings-profile-details";

/** Rows shown before "Show N more qualifications" (she can list up to 20), newest first. */
const QUALIFICATIONS_SHOWN = 6;
/** Up to this many, all show, as in Services & prices (user, 2026-10-15). */
const QUALIFICATIONS_COLLAPSE_ABOVE = 8;

/**
 * "Qualifications" as a CV lists them (user, 2026-10-14): one card, newest first, the year in a
 * column on the left (empty when she gave none), the title, and the institution below it.
 * What she keeps in Settings › Profile; DocCy does not check them. Hidden when she has none.
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
        className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-profile-text sm:text-[28px]"
      >
        <ProfileHeadingIcon icon={GraduationCap} />
        {t("qualificationsHeading")}
      </h2>
      <ProfileShowAll
        name="qualifications"
        shown={QUALIFICATIONS_SHOWN}
        collapseAbove={QUALIFICATIONS_COLLAPSE_ABOVE}
        total={qualifications.length}
        showMoreLabel={t("qualificationsShowMore", { count: qualifications.length - QUALIFICATIONS_SHOWN })}
        showFewerLabel={t("servicesShowFewer")}
        className="overflow-hidden rounded-2xl border border-profile-border bg-profile-surface"
        listClassName="divide-y divide-profile-border"
      >
        {qualificationsNewestFirst(qualifications).map((qualification) => {
          const institution = qualification.institution.trim();
          return (
            <li
              key={qualification.id}
              data-testid="profile-qualification"
              className="flex items-baseline gap-4 px-5 py-3.5"
            >
              <span
                data-testid="profile-qualification-year"
                className="w-12 shrink-0 text-sm font-medium tabular-nums text-profile-muted"
              >
                {qualification.year ?? ""}
              </span>
              <span className="min-w-0">
                <span className="block break-words font-semibold text-profile-text">{qualification.title}</span>
                {institution ? (
                  <span className="mt-0.5 block break-words text-sm text-profile-muted">{institution}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ProfileShowAll>
    </section>
  );
}
