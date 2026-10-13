import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { patientAgesMessageKey } from "@/lib/public/profile-public-details";
import type { PatientAges } from "@/lib/settings-profile-details";

/**
 * "Patients seen": adults, children or both, her "Patients I see" in Settings › Profile.
 * Hidden when she has not chosen. No tab of its own: it is one line.
 */
export async function ProfilePatientsSection({ patientAges }: { patientAges: PatientAges | null }) {
  const patientsKey = patientAgesMessageKey(patientAges);
  if (!patientsKey) return null;
  const t = await getTranslations("DoctorProfilePage");

  return (
    <section
      aria-labelledby="profile-patients-heading"
      className="grid scroll-mt-20 gap-5"
    >
      <h2
        id="profile-patients-heading"
        className="text-2xl font-extrabold tracking-tight text-profile-text sm:text-[28px]"
      >
        {t("patientsSeenHeading")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <p
          data-testid="profile-patients-seen"
          className="flex items-center gap-3 rounded-2xl border border-profile-border bg-profile-surface px-5 py-4"
        >
          <Users className="h-5 w-5 shrink-0 text-accent-link" aria-hidden />
          <span className="font-semibold text-profile-text">{t(patientsKey)}</span>
        </p>
      </div>
    </section>
  );
}
