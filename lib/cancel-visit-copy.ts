/**
 * The professional's "cancel this confirmed visit" dialog. DocCy emails the patient only when
 * the visit has an email; a manual visit without one can't be told by us, so the dialog says to
 * call them and shows the phone (manual test F4, user 2026-10-08).
 */
export type CancelConfirmedVisitCopy = {
  notifiesByEmail: boolean;
  intro: string;
  /** Tap-to-call for the patient's phone when there is no email. */
  call: { label: string; href: string } | null;
  confirmLabel: string;
};

export function cancelConfirmedVisitCopy(visit: {
  patientEmail: string | null | undefined;
  patientPhone: string | null | undefined;
}): CancelConfirmedVisitCopy {
  if (String(visit.patientEmail ?? "").trim()) {
    return {
      notifiesByEmail: true,
      intro:
        "The patient will receive an email that this confirmed visit is cancelled, with your explanation and a link to book again.",
      call: null,
      confirmLabel: "Cancel & notify",
    };
  }
  const phone = String(visit.patientPhone ?? "").trim();
  const digits = phone.replace(/[^\d+]/g, "");
  return {
    notifiesByEmail: false,
    intro: phone
      ? "This patient has no email, so DocCy can't tell them. Please call them to let them know:"
      : "This patient has no email or phone, so DocCy can't tell them about the cancellation.",
    call: phone && digits.replace(/\D/g, "").length >= 7 ? { label: phone, href: `tel:${digits}` } : null,
    confirmLabel: "Cancel visit",
  };
}
