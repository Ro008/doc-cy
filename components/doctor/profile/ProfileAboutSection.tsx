import { getTranslations } from "next-intl/server";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";

type Props = {
  firstName: string;
  bio: string | null;
};

/**
 * "About": the bio, open (no accordion). Languages and the patients she sees are facts of
 * the hero (user, 2026-10-14).
 */
export async function ProfileAboutSection({ firstName, bio }: Props) {
  const t = await getTranslations("DoctorProfilePage");
  const bioText = (bio ?? "").trim();

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
      <p
        className={`max-w-prose whitespace-pre-wrap text-base leading-relaxed sm:text-[17px] ${
          bioText ? "text-profile-body" : "text-profile-muted"
        }`}
      >
        {bioText || t("aboutEmpty")}
      </p>
    </section>
  );
}
