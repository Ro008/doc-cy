"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { CYPRUS_DISTRICTS } from "@/lib/cyprus-districts";
import { getPublicBookingBaseUrl } from "@/lib/site-url";
import { AvatarCropDialog, prepareAvatarSource } from "@/components/auth/AvatarCropDialog";
import { REGISTER_AVATAR_ACCEPT } from "@/lib/register-avatar";
import { registerLanguageOptions } from "@/lib/register-languages";
import { CYPRUS_SPOKEN_LANGUAGE_LABELS } from "@/lib/cyprus-languages";
import { Check, ChevronDown } from "lucide-react";
import { ClinicAddressAutocomplete } from "@/components/dashboard/ClinicAddressAutocomplete";
import { MAX_DOCTOR_LOCATIONS } from "@/lib/doctor-locations";
import type { ClinicLocation } from "@/lib/clinic-location";
import type {
  ProfessionalRegistrationDetails,
  RegistrationClinic,
} from "@/lib/professional-registration-request";
import type { RegistrationReviewItem, ReviewClinicInfo, ReviewListing } from "@/lib/registration-requests";

type Props = {
  items: RegistrationReviewItem[];
  /** Pending requests left out because their applicant login no longer exists. */
  hiddenPending?: number;
  /** Founders decide; partners only see. */
  canMutate: boolean;
  /** The global trial length (app_settings), shown as the default. */
  defaultTrialMonths: number | null;
  /** The specialty catalogue, offered when founders add a specialty. */
  specialtyCatalogue?: readonly string[];
};

/** Same limit as the registration form. */
const MAX_REVIEW_SPECIALTIES = 5;

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 disabled:opacity-60";
const labelClass = "flex flex-col gap-1 text-xs text-slate-400";
const contactWarningClass = "text-[11px] font-semibold text-red-300";
const chipBaseClass = "rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide";
const chipCatalogueClass = `${chipBaseClass} bg-emerald-500/15 text-emerald-200`;
const chipNewClass = `${chipBaseClass} bg-amber-500/20 text-amber-200`;
const chipPrimaryClass = `${chipBaseClass} bg-clinical-500/20 text-clinical-200`;
const addButtonClass =
  "rounded-lg border border-dashed border-clinical-400/50 px-3 py-1.5 text-xs font-semibold text-clinical-200 hover:bg-clinical-500/10 disabled:opacity-60";

/**
 * Languages as the registration form shows them: one-click pills from the same list
 * (the most common first, the rest behind "More languages"), never free text.
 */
function ReviewLanguagePills({
  requestId,
  selected,
  disabled,
  onChange,
}: {
  requestId: string;
  selected: readonly string[];
  disabled: boolean;
  onChange: (languages: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { visible, hiddenCount } = registerLanguageOptions(selected, expanded);
  const labelId = `request-languages-${requestId}`;
  const toggle = (label: string, checked: boolean) => {
    const next = checked ? [...selected, label] : selected.filter((item) => item !== label);
    // Keep the list's order, as the form and the approval do.
    onChange(CYPRUS_SPOKEN_LANGUAGE_LABELS.filter((item) => next.includes(item)));
  };
  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-xs text-slate-400">
        Languages
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-2">
        {visible.map((label) => {
          const checked = selected.includes(label);
          return (
            <label
              key={label}
              data-testid={`request-language-option-${label.replace(/\s+/g, "-")}`}
              className={`relative ${disabled ? "cursor-default" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => toggle(label, event.target.checked)}
                className="peer sr-only"
              />
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-600 bg-slate-950 px-3 text-xs font-semibold text-slate-200 transition hover:border-clinical-400/70 peer-checked:border-clinical-400 peer-checked:bg-clinical-500 peer-checked:text-ink-900 peer-focus-visible:ring-2 peer-focus-visible:ring-clinical-400/60 peer-disabled:opacity-70">
                {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : null}
                {label}
              </span>
            </label>
          );
        })}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold text-clinical-300 hover:bg-clinical-500/10"
        >
          {expanded ? "Fewer languages" : `More languages (${hiddenCount})`}
          <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>
      {selected.length === 0 ? (
        <span className="text-[11px] font-semibold text-amber-300">Pick at least one language before approving</span>
      ) : null}
    </div>
  );
}

/** One section of a request (Applicant, Specialties, Clinics, …): its own panel and heading. */
function ReviewPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-700/80 bg-slate-900/70 p-3 sm:p-4">
      <h4 className="text-sm font-semibold tracking-wide text-white">{title}</h4>
      {children}
    </section>
  );
}

/** One item in a section (a specialty, a clinic): a card with its own header bar. */
function ReviewItemCard({
  number,
  title,
  chip,
  onRemove,
  removeLabel,
  disabled,
  dataAttrs,
  children,
}: {
  number: number;
  title: string;
  chip?: React.ReactNode;
  onRemove?: () => void;
  removeLabel: string;
  disabled: boolean;
  dataAttrs?: Record<string, string | number>;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-600/70 bg-slate-950/80" {...dataAttrs}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-700/80 bg-slate-800/70 px-3 py-2">
        <span
          aria-hidden
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-white"
        >
          {number}
        </span>
        <span className="min-w-0 truncate font-semibold text-white">{title}</span>
        {chip}
        {onRemove ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onRemove}
            aria-label={removeLabel}
            className="ml-auto rounded-md px-2 py-0.5 text-xs font-semibold text-red-300 hover:bg-red-500/10"
          >
            Remove
          </button>
        ) : null}
      </div>
      <div className="space-y-3 p-3">{children}</div>
    </div>
  );
}

/**
 * Registration requests (professional_registration). Founders review every field
 * (all editable except the email, which is the login), the photo, and whether the
 * applicant claims an existing listing, then DENY with a reason or APPROVE.
 */
export function RegistrationRequestsSection({
  items,
  hiddenPending = 0,
  canMutate,
  defaultTrialMonths,
  specialtyCatalogue = [],
}: Props) {
  const pending = items.filter((item) => item.status === "pending");
  const decided = items.filter((item) => item.status !== "pending");
  // Marks when the section is interactive (tests wait for it on this heavy page).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return (
    <section
      id="requests"
      data-hydrated={hydrated ? "1" : "0"}
      className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/30 p-5"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Requests</h2>
        <p className="text-sm text-slate-400">
          {pending.length === 0
            ? "No registration requests waiting."
            : `${pending.length} registration request${pending.length === 1 ? "" : "s"} waiting for review.`}
        </p>
        {hiddenPending > 0 ? (
          <p className="mt-1 text-xs text-slate-500" data-testid="requests-hidden-pending">
            {hiddenPending} pending request{hiddenPending === 1 ? "" : "s"} not shown: the applicant&apos;s account no
            longer exists, so {hiddenPending === 1 ? "it" : "they"} can&apos;t be approved (automated test runs leave
            these behind).
          </p>
        ) : null}
      </div>
      {pending.map((item) => (
        <RequestCard
          key={item.id}
          item={item}
          canMutate={canMutate}
          defaultTrialMonths={defaultTrialMonths}
          specialtyCatalogue={specialtyCatalogue}
        />
      ))}
      {decided.length > 0 ? (
        <details className="rounded-xl border border-slate-800 p-3 text-sm text-slate-300">
          <summary className="cursor-pointer text-slate-200">Recent decisions</summary>
          <ul className="mt-2 space-y-1">
            {decided.map((item) => (
              <li key={item.id} data-decided-request-id={item.id}>
                <span className="font-medium">{item.requesterName}</span>{" "}
                <span className={item.status === "approved" ? "text-emerald-300" : "text-red-300"}>
                  {item.status === "approved" ? "Approved" : item.status === "rejected" ? "Denied" : "Withdrawn"}
                </span>
                {item.decidedAt ? ` · ${new Date(item.decidedAt).toLocaleDateString("en-GB")}` : null}
                {item.decisionNote ? ` · ${item.decisionNote}` : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

type ListingCheck =
  | { state: "empty" }
  | { state: "unchecked" }
  | { state: "checking" }
  | { state: "ok"; listing: ReviewListing }
  | { state: "error"; message: string };

function RequestCard({
  item,
  canMutate,
  defaultTrialMonths,
  specialtyCatalogue,
}: {
  item: RegistrationReviewItem;
  canMutate: boolean;
  defaultTrialMonths: number | null;
  specialtyCatalogue: readonly string[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProfessionalRegistrationDetails>(item.details);
  const [clinicNames, setClinicNames] = useState<Record<string, ReviewClinicInfo>>(item.clinics);
  const [photoUrl, setPhotoUrl] = useState<string | null>(item.photoUrl);
  /** The picked replacement photo, open in the crop dialog. */
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [listingUrl, setListingUrl] = useState("");
  const [listingCheck, setListingCheck] = useState<ListingCheck>({ state: "empty" });
  const [trialMonths, setTrialMonths] = useState("");
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<"approved" | "denied" | null>(null);

  const claimedByApplicant = Boolean(item.details.claimed_professional_id);
  const disabled = !canMutate || busy || decision !== null;
  const blockedByListing =
    !claimedByApplicant && listingCheck.state !== "empty" && listingCheck.state !== "ok";

  const update = (patch: Partial<ProfessionalRegistrationDetails>) => setDraft((d) => ({ ...d, ...patch }));
  const updateClinic = (index: number, patch: Partial<RegistrationClinic>) =>
    setDraft((d) => ({ ...d, clinics: d.clinics.map((c, i) => (i === index ? { ...c, ...patch } : c)) }));

  async function checkListing() {
    setListingCheck({ state: "checking" });
    try {
      const res = await fetch(`/api/internal/requests/listing?url=${encodeURIComponent(listingUrl.trim())}`);
      const json = (await res.json().catch(() => ({}))) as { listing?: ReviewListing; message?: string };
      if (!res.ok || !json.listing) {
        setListingCheck({ state: "error", message: json.message ?? "Could not check the listing." });
        return;
      }
      setListingCheck({ state: "ok", listing: json.listing });
    } catch {
      setListingCheck({ state: "error", message: "Could not check the listing." });
    }
  }

  /** A picked photo goes through the form's checks, then the same crop dialog. */
  async function pickReplacementPhoto(file: File) {
    const prepared = await prepareAvatarSource(file);
    if (prepared.ok === false) {
      setPhotoError(prepared.message);
      return;
    }
    setPhotoError(null);
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(prepared.url);
  }

  function closeCrop() {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
  }

  /** Uploads the cropped JPEG (900×900, like the form's). */
  async function replacePhoto(file: File) {
    setBusy(true);
    setPhotoError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch(`/api/internal/requests/${item.id}/photo`, { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { path?: string; url?: string | null; message?: string };
      if (!res.ok || !json.path) {
        setPhotoError(json.message ?? "Could not replace the photo.");
        return;
      }
      update({ photo: { bucket: "request-uploads", path: json.path } });
      setPhotoUrl(json.url ?? null);
    } finally {
      setBusy(false);
      closeCrop();
    }
  }

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const details: ProfessionalRegistrationDetails = {
        ...draft,
        claimed_professional_id: claimedByApplicant
          ? draft.claimed_professional_id
          : listingCheck.state === "ok"
            ? listingCheck.listing.id
            : null,
      };
      const res = await fetch(`/api/internal/requests/${item.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ details, trialMonths: trialMonths.trim() === "" ? null : Number(trialMonths) }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(json.message ?? "Could not approve this request.");
        return;
      }
      setDecision("approved");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deny() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/internal/requests/${item.id}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(json.message ?? "Could not deny this request.");
        return;
      }
      setDecision("denied");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const specialtyRows = useMemo(() => draft.specialties, [draft.specialties]);
  const catalogueKeys = useMemo(
    () => new Set(specialtyCatalogue.map((name) => name.trim().toLowerCase())),
    [specialtyCatalogue],
  );

  return (
    <article
      data-request-id={item.id}
      className="space-y-5 rounded-2xl border border-slate-600/80 bg-slate-950/60 p-4 text-sm text-slate-200 shadow-lg shadow-black/20 sm:p-5"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-white">{item.requesterName}</h3>
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${
            claimedByApplicant || listingCheck.state === "ok"
              ? "bg-violet-500/20 text-violet-200"
              : "bg-slate-700/60 text-slate-200"
          }`}
        >
          {claimedByApplicant ? "CLAIMED PROFILE" : "UNCLAIMED PROFILE"}
        </span>
        {item.isTest ? (
          <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-200">TEST</span>
        ) : null}
        <span className="text-xs text-slate-400">
          Submitted {new Date(item.createdAt).toLocaleString("en-GB")} · Founders&apos; Club place:{" "}
          {item.details.founders_club ? "reserved" : "no"}
        </span>
      </header>

      <ReviewPanel title="Applicant">
      <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
        <div className="space-y-2">
          {draft.photo && photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL of a private upload
            <img
              src={photoUrl}
              alt={`Applicant photo: ${item.requesterName}`}
              className="h-40 w-40 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-xl border border-dashed border-slate-700 text-xs text-slate-500">
              No photo
            </div>
          )}
          {canMutate ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {draft.photo ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => update({ photo: null })}
                  className="rounded-lg border border-slate-700 px-2 py-1 hover:border-red-400/60"
                >
                  Remove photo
                </button>
              ) : null}
              <label className="cursor-pointer rounded-lg border border-slate-700 px-2 py-1 hover:border-clinical-500/60">
                Replace photo
                <input
                  type="file"
                  accept={REGISTER_AVATAR_ACCEPT}
                  className="sr-only"
                  disabled={disabled}
                  data-testid="request-photo-file-input"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    // Reset so picking the same file again still fires `change`.
                    event.target.value = "";
                    if (file) void pickReplacementPhoto(file);
                  }}
                />
              </label>
            </div>
          ) : null}
          {canMutate ? (
            <p className="text-[11px] text-slate-500">JPG, PNG or WebP · at least 400×400 px · max 10 MB</p>
          ) : null}
          {photoError ? (
            <p role="alert" data-testid="request-photo-error" className="text-xs text-red-300">
              {photoError}
            </p>
          ) : null}
          {cropSource ? (
            <AvatarCropDialog
              sourceUrl={cropSource}
              title="Crop the photo"
              onCancel={closeCrop}
              onConfirm={(file) => replacePhoto(file)}
            />
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            First name
            <input className={inputClass} disabled={disabled} value={draft.first_name}
              onChange={(e) => update({ first_name: e.target.value })} />
          </label>
          <label className={labelClass}>
            Last name
            <input className={inputClass} disabled={disabled} value={draft.last_name}
              onChange={(e) => update({ last_name: e.target.value })} />
          </label>
          <label className={labelClass}>
            Email
            <input className={inputClass} disabled value={draft.email} readOnly />
            {item.contactInUse?.email === "professional" ? (
              <span className={contactWarningClass} data-testid="request-email-in-use">
                Already used by another professional
              </span>
            ) : null}
          </label>
          <label className={labelClass}>
            Mobile
            <input className={inputClass} disabled={disabled} value={draft.mobile}
              onChange={(e) => update({ mobile: e.target.value })} />
            {item.contactInUse?.mobile && draft.mobile === item.details.mobile ? (
              <span className={contactWarningClass} data-testid="request-mobile-in-use">
                Already used by another professional: correct it, or deny
              </span>
            ) : null}
          </label>
          <label className={labelClass}>
            Gender
            <select className={inputClass} disabled={disabled} value={draft.gender}
              onChange={(e) => update({ gender: e.target.value as "male" | "female" })}>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>
          <label className={labelClass}>
            Works with GeSY
            <select className={inputClass} disabled={disabled} value={draft.gesy ? "yes" : "no"}
              onChange={(e) => update({ gesy: e.target.value === "yes" })}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <ReviewLanguagePills
              requestId={item.id}
              selected={draft.languages}
              disabled={disabled}
              onChange={(languages) => update({ languages })}
            />
          </div>
        </div>
      </div>
      </ReviewPanel>

      <ReviewPanel title={`Specialties (${specialtyRows.length})`}>
        {specialtyRows.map((specialty, index) => {
          const named = Boolean(specialty.name.trim());
          return (
            <ReviewItemCard
              key={index}
              number={index + 1}
              title={named ? specialty.name : "New specialty"}
              chip={
                named ? (
                  <span
                    data-testid={`request-specialty-kind-${index}`}
                    className={specialty.from_catalogue ? chipCatalogueClass : chipNewClass}
                  >
                    {specialty.from_catalogue
                      ? "From the catalogue"
                      : "New specialty: approving adds it to the catalogue"}
                  </span>
                ) : null
              }
              onRemove={
                canMutate && draft.specialties.length > 1
                  ? () => update({ specialties: draft.specialties.filter((_, i) => i !== index) })
                  : undefined
              }
              removeLabel={`Remove specialty ${index + 1}`}
              disabled={disabled}
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                <label className={labelClass}>
                  Specialty
                  <input
                    className={inputClass}
                    disabled={disabled}
                    value={specialty.name}
                    aria-label={`Specialty ${index + 1}`}
                    list={`request-specialty-catalogue-${item.id}`}
                    placeholder="Pick from the list, or type a new specialty"
                    onChange={(e) => {
                      const name = e.target.value;
                      const fromCatalogue = catalogueKeys.has(name.trim().toLowerCase());
                      update({
                        specialties: draft.specialties.map((s, i) =>
                          i === index ? { ...s, name, from_catalogue: fromCatalogue } : s,
                        ),
                      });
                    }}
                  />
                  <span className="text-[11px] text-slate-500">
                    Not in the list? Type it: approving adds it to the catalogue.
                  </span>
                </label>
                <label className={labelClass}>
                  Licence number
                  <input
                    className={inputClass}
                    disabled={disabled}
                    value={specialty.license_number}
                    aria-label={`Licence number for specialty ${index + 1}`}
                    data-testid={`request-specialty-licence-${index}`}
                    onChange={(e) =>
                      update({
                        specialties: draft.specialties.map((s, i) =>
                          i === index ? { ...s, license_number: e.target.value } : s,
                        ),
                      })
                    }
                  />
                </label>
              </div>
            </ReviewItemCard>
          );
        })}
        <datalist id={`request-specialty-catalogue-${item.id}`}>
          {specialtyCatalogue.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {canMutate && draft.specialties.length < MAX_REVIEW_SPECIALTIES ? (
          <button type="button" disabled={disabled} className={addButtonClass}
            onClick={() =>
              update({
                specialties: [...draft.specialties, { name: "", from_catalogue: false, license_number: "" }],
              })
            }
          >
            + Add specialty
          </button>
        ) : null}
      </ReviewPanel>

      <ReviewPanel title={`Clinics (${draft.clinics.length})`}>
        {draft.clinics.map((clinic, index) => (
          <ClinicRow
            key={index}
            index={index}
            clinic={clinic}
            info={clinic.clinic_id ? clinicNames[clinic.clinic_id] : undefined}
            disabled={disabled}
            canMutate={canMutate}
            onChange={(patch) => updateClinic(index, patch)}
            onPickExisting={(picked) => {
              setClinicNames((names) => ({ ...names, [picked.id]: picked }));
              // The DocCy clinic brings its own address and district (an added row has none).
              updateClinic(index, {
                clinic_id: picked.id,
                name: null,
                address: picked.address ?? clinic.address,
                district: picked.district ?? clinic.district,
                phone: null,
              });
            }}
            onRemove={
              draft.clinics.length > 1
                ? () => update({ clinics: draft.clinics.filter((_, i) => i !== index) })
                : undefined
            }
          />
        ))}
        {canMutate && draft.clinics.length < MAX_DOCTOR_LOCATIONS ? (
          <button type="button" disabled={disabled} className={addButtonClass}
            onClick={() => update({ clinics: [...draft.clinics, emptyReviewClinic()] })}
          >
            + Add clinic
          </button>
        ) : null}
      </ReviewPanel>

      <ReviewPanel title="Directory listing">
        {claimedByApplicant ? (
          <p>
            Claims{" "}
            {item.claimedListing ? (
              <a className="text-clinical-300 underline" href={item.claimedListing.path} target="_blank" rel="noreferrer">
                {item.claimedListing.name} ({item.claimedListing.path})
              </a>
            ) : (
              "a listing that no longer exists"
            )}
            . Approving updates that listing in place.
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-400">
              Search the directory for this professional. If they already have a listing, paste its URL so approving
              updates it instead of creating a second profile. Leave empty for a new profile.
            </p>
            <div className="flex flex-wrap gap-2">
              <label className={`${labelClass} min-w-[260px] flex-1`}>
                Listing URL
                <input
                  className={inputClass}
                  disabled={disabled}
                  value={listingUrl}
                  placeholder={`${getPublicBookingBaseUrl()}/en/…`}
                  onChange={(e) => {
                    setListingUrl(e.target.value);
                    setListingCheck({ state: e.target.value.trim() ? "unchecked" : "empty" });
                  }}
                />
              </label>
              <button
                type="button"
                disabled={disabled || !listingUrl.trim()}
                onClick={() => void checkListing()}
                className="self-end rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-clinical-500/60 disabled:opacity-50"
              >
                Check listing
              </button>
            </div>
            {listingCheck.state === "ok" ? (
              <p className="text-emerald-300">
                ✓ {listingCheck.listing.name} ({listingCheck.listing.path}): approving claims this listing.
              </p>
            ) : null}
            {listingCheck.state === "error" ? (
              <p role="alert" className="text-red-300">
                {listingCheck.message}
              </p>
            ) : null}
            {listingCheck.state === "unchecked" ? (
              <p className="text-xs text-amber-300">Check the listing (or clear the box) before approving.</p>
            ) : null}
          </>
        )}
      </ReviewPanel>

      <ReviewPanel title="Decision">
      {decision ? (
        <p className={decision === "approved" ? "font-semibold text-emerald-300" : "font-semibold text-red-300"}>
          {decision === "approved" ? "Approved" : "Denied"}
        </p>
      ) : canMutate ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className={labelClass}>
            Trial months (this approval only)
            <input
              type="number"
              min={0}
              max={24}
              step={1}
              className={`${inputClass} w-32`}
              disabled={disabled}
              value={trialMonths}
              placeholder={defaultTrialMonths == null ? "" : `${defaultTrialMonths} (default)`}
              onChange={(e) => setTrialMonths(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={disabled || blockedByListing}
            onClick={() => void approve()}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            APPROVE
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setDenying((d) => !d)}
            className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-500 disabled:opacity-50"
          >
            DENY
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Read-only: only founders decide requests.</p>
      )}

      {denying && !decision && canMutate ? (
        <div className="space-y-2">
          <label className={labelClass}>
            Reason (emailed to the applicant)
            <textarea className={inputClass} rows={3} value={reason} disabled={busy}
              onChange={(e) => setReason(e.target.value)} />
          </label>
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={() => void deny()}
            className="rounded-lg bg-red-700 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
          >
            Confirm deny
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      ) : null}
      </ReviewPanel>
    </article>
  );
}

function ClinicRow({
  index,
  clinic,
  info,
  disabled,
  canMutate,
  onChange,
  onPickExisting,
  onRemove,
}: {
  index: number;
  clinic: RegistrationClinic;
  info: ReviewClinicInfo | undefined;
  disabled: boolean;
  canMutate: boolean;
  onChange: (patch: Partial<RegistrationClinic>) => void;
  onPickExisting: (clinic: ReviewClinicInfo) => void;
  onRemove?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReviewClinicInfo[]>([]);

  async function search(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    const res = await fetch(`/api/register/clinic-search?q=${encodeURIComponent(value.trim())}`);
    const json = (await res.json().catch(() => ({}))) as {
      results?: Array<{ id: string; name: string; address: string | null; district: string | null }>;
    };
    setResults((json.results ?? []).map((r) => ({ id: r.id, name: r.name, address: r.address, district: r.district })));
  }

  return (
    <ReviewItemCard
      number={index + 1}
      dataAttrs={{ "data-request-clinic-row": index }}
      title={
        (clinic.clinic_id ? info?.name : clinic.name?.trim()) ||
        (clinic.clinic_id ? "DocCy clinic" : "New clinic")
      }
      chip={
        <>
          {index === 0 ? <span className={chipPrimaryClass}>Primary</span> : null}
          <span className={clinic.clinic_id ? chipCatalogueClass : chipNewClass}>
            {clinic.clinic_id ? "existing DocCy clinic" : "new clinic (created on approval)"}
          </span>
        </>
      }
      onRemove={canMutate ? onRemove : undefined}
      removeLabel={`Remove clinic ${index + 1}`}
      disabled={disabled}
    >
      {clinic.clinic_id ? (
        <p>
          {info?.name ?? "Clinic"} · {info?.address ?? clinic.address} · {info?.district ?? clinic.district}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={labelClass}>
            Clinic name
            <input className={inputClass} disabled={disabled} value={clinic.name ?? ""}
              onChange={(e) => onChange({ name: e.target.value })} />
          </label>
          <div className={`${labelClass} sm:col-span-2`}>
            <span>Location (what patients see; search the address or drop a pin)</span>
            <ClinicAddressAutocomplete
              id={`request-clinic-location-${index}`}
              value={reviewClinicLocation(clinic)}
              disabled={disabled}
              onChange={(location) => onChange(reviewClinicPatch(location))}
            />
            {clinic.address.trim() ? null : (
              <span className="text-[11px] font-semibold text-amber-300">Needed before approving</span>
            )}
          </div>
          <label className={labelClass}>
            Clinic phone (shown to patients)
            <input className={inputClass} disabled={disabled} value={clinic.phone ?? ""}
              data-testid={`request-clinic-phone-${index}`}
              placeholder="e.g. 25 123456"
              onChange={(e) => onChange({ phone: e.target.value || null })} />
            {clinic.phone ? null : <span className="text-[11px] font-semibold text-amber-300">Needed before approving</span>}
          </label>
          {canMutate ? (
            <label className={`${labelClass} sm:col-span-2`}>
              Or use an existing DocCy clinic
              <input className={inputClass} disabled={disabled} value={query} placeholder="Search clinics…"
                onChange={(e) => void search(e.target.value)} />
              {results.length > 0 ? (
                <ul className="rounded-lg border border-slate-700 bg-slate-950">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="w-full px-2 py-1 text-left hover:bg-slate-800"
                        onClick={() => {
                          onPickExisting(r);
                          setResults([]);
                          setQuery("");
                        }}
                      >
                        {r.name} · {r.address} · {r.district}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </label>
          ) : null}
        </div>
      )}
    </ReviewItemCard>
  );
}

/** A clinic row founders add: new until they place it or pick an existing DocCy clinic. */
function emptyReviewClinic(): RegistrationClinic {
  return {
    clinic_id: null,
    name: "",
    address: "",
    district: "",
    town: null,
    latitude: Number.NaN,
    longitude: Number.NaN,
    place_id: null,
    phone: null,
  };
}

function reviewClinicLocation(clinic: RegistrationClinic): ClinicLocation {
  const known = (value: number) => (Number.isFinite(value) ? value : null);
  return {
    address: clinic.address,
    latitude: known(clinic.latitude),
    longitude: known(clinic.longitude),
    placeId: clinic.place_id,
    district: (CYPRUS_DISTRICTS as readonly string[]).includes(clinic.district)
      ? (clinic.district as ClinicLocation["district"])
      : null,
    town: clinic.town,
  };
}

/** The map field's result, in the request's shape. A missing pin stays "unknown" (NaN → null in JSON). */
function reviewClinicPatch(location: ClinicLocation): Partial<RegistrationClinic> {
  return {
    address: location.address,
    district: location.district ?? "",
    town: location.town,
    latitude: location.latitude ?? Number.NaN,
    longitude: location.longitude ?? Number.NaN,
    place_id: location.placeId,
  };
}
