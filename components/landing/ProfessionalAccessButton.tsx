"use client";

import { PendingLink } from "@/components/navigation/PendingLink";
import { useDoctorSession } from "@/components/navigation/DoctorSessionProvider";
import { DOCTOR_HOME_PATH } from "@/lib/doctor-routes";

export function ProfessionalAccessButton({
  proSessionHint = false,
}: {
  proSessionHint?: boolean;
}) {
  const { sessionState } = useDoctorSession();
  const isLoggedIn = sessionState.isLoggedIn || proSessionHint;

  return (
    <PendingLink
      href={isLoggedIn ? DOCTOR_HOME_PATH : "/login"}
      className="inline-flex min-w-[11.5rem] items-center justify-center rounded-xl border-2 border-clinical-300 bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 shadow-sm transition hover:border-clinical-400 hover:bg-clinical-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50"
    >
      {isLoggedIn ? "My Dashboard" : "Practitioner login"}
    </PendingLink>
  );
}
