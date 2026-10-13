import { Mail, Phone } from "lucide-react";

import { patientBirthdateLabel, patientSummaryParts } from "@/lib/patient-details";

/**
 * Who the patient is, for the professional only (user, 2026-10-06): age, gender, first
 * visit or not, then phone (tap to call) and email (tap to write). Shared by the agenda's
 * visit dialog and the request page. Missing values are left out.
 */
export function PatientDetails({
  birthdate,
  gender,
  isNewPatient,
  phone,
  email,
  testId,
  className = "",
}: {
  birthdate?: string | null;
  gender?: string | null;
  isNewPatient?: boolean | null;
  phone?: string | null;
  email?: string | null;
  testId?: string;
  className?: string;
}) {
  const parts = patientSummaryParts({ birthdate, gender, isNewPatient });
  const born = patientBirthdateLabel(birthdate);
  const tel = String(phone ?? "").trim();
  const mail = String(email ?? "").trim();
  if (parts.length === 0 && !tel && !mail) return null;

  return (
    <div data-testid={testId} className={`space-y-1.5 text-sm ${className}`}>
      {parts.length > 0 ? (
        <p className="text-slate-200">
          <span data-testid="patient-summary">{parts.join(" · ")}</span>
          {born ? <span className="ml-1.5 text-xs text-slate-500">({born})</span> : null}
        </p>
      ) : null}
      {tel || mail ? (
        <div className="flex flex-col gap-1">
          {tel ? (
            <a
              href={`tel:${tel.replace(/[^\d+]/g, "")}`}
              className="inline-flex w-fit items-center gap-2 text-clinical-200 underline-offset-2 hover:text-clinical-100 hover:underline"
            >
              <Phone className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              {tel}
            </a>
          ) : null}
          {mail ? (
            <a
              href={`mailto:${mail}`}
              className="inline-flex w-fit min-w-0 items-center gap-2 break-all text-clinical-200 underline-offset-2 hover:text-clinical-100 hover:underline"
            >
              <Mail className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              {mail}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
