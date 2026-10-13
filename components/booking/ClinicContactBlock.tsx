import { formatCyprusPhoneDisplay, phoneToTelHref } from "@/lib/phone-link";

export type ClinicContact = {
  name: string;
  address: string | null;
  phone: string | null;
  mapsUrl: string | null;
};

/**
 * The clinic's name, its address (linked to the Maps pin) and its phone (tap to call, with
 * the +357 prefix). Shown when a patient has to phone the clinic. Links are not underlined.
 */
export function ClinicContactBlock({ clinic }: { clinic: ClinicContact }) {
  const telHref = phoneToTelHref(clinic.phone);
  const linkClass = "mt-1 block text-clinical-300 hover:text-clinical-200";
  return (
    <div
      data-testid="clinic-contact"
      className="mt-4 rounded-2xl border border-slate-700 bg-ink-900/60 px-4 py-3 text-left text-sm"
    >
      <p className="font-semibold text-slate-100">{clinic.name}</p>
      {clinic.address ? (
        clinic.mapsUrl ? (
          <a href={clinic.mapsUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {clinic.address}
          </a>
        ) : (
          <p className="mt-1 text-slate-300">{clinic.address}</p>
        )
      ) : null}
      {telHref ? (
        <a href={telHref} className={`${linkClass} text-base font-semibold`}>
          {formatCyprusPhoneDisplay(clinic.phone)}
        </a>
      ) : null}
    </div>
  );
}
