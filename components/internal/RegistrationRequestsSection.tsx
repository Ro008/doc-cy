"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { CYPRUS_DISTRICTS } from "@/lib/cyprus-districts";
import type {
  ProfessionalRegistrationDetails,
  RegistrationClinic,
} from "@/lib/professional-registration-request";
import type { RegistrationReviewItem, ReviewClinicInfo, ReviewListing } from "@/lib/registration-requests";

type Props = {
  items: RegistrationReviewItem[];
  /** Founders decide; partners only see. */
  canMutate: boolean;
  /** The global trial length (app_settings), shown as the default. */
  defaultTrialMonths: number | null;
};

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 disabled:opacity-60";
const labelClass = "flex flex-col gap-1 text-xs text-slate-400";

/**
 * Registration requests (professional_registration). Founders review every field
 * (all editable except the email, which is the login), the photo, and whether the
 * applicant claims an existing listing, then DENY with a reason or APPROVE.
 */
export function RegistrationRequestsSection({ items, canMutate, defaultTrialMonths }: Props) {
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
      </div>
      {pending.map((item) => (
        <RequestCard key={item.id} item={item} canMutate={canMutate} defaultTrialMonths={defaultTrialMonths} />
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
}: {
  item: RegistrationReviewItem;
  canMutate: boolean;
  defaultTrialMonths: number | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProfessionalRegistrationDetails>(item.details);
  const [clinicNames, setClinicNames] = useState<Record<string, ReviewClinicInfo>>(item.clinics);
  const [photoUrl, setPhotoUrl] = useState<string | null>(item.photoUrl);
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

  async function replacePhoto(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch(`/api/internal/requests/${item.id}/photo`, { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { path?: string; url?: string | null; message?: string };
      if (!res.ok || !json.path) {
        setError(json.message ?? "Could not replace the photo.");
        return;
      }
      update({ photo: { bucket: "request-uploads", path: json.path } });
      setPhotoUrl(json.url ?? null);
    } finally {
      setBusy(false);
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

  return (
    <article
      data-request-id={item.id}
      className="space-y-4 rounded-xl border border-slate-700/80 bg-slate-950/40 p-4 text-sm text-slate-200"
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
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={disabled}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void replacePhoto(file);
                  }}
                />
              </label>
            </div>
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
          </label>
          <label className={labelClass}>
            Mobile
            <input className={inputClass} disabled={disabled} value={draft.mobile}
              onChange={(e) => update({ mobile: e.target.value })} />
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
          <label className={`${labelClass} sm:col-span-2`}>
            Languages (comma-separated)
            <input className={inputClass} disabled={disabled} value={draft.languages.join(", ")}
              onChange={(e) => update({ languages: e.target.value.split(",").map((l) => l.trim()) })} />
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Specialties</h4>
        {specialtyRows.map((specialty, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
            <label className={labelClass}>
              <span>
                Specialty {index + 1}
                {specialty.from_catalogue ? null : (
                  <span className="ml-2 text-amber-300">not in the catalogue: approving adds it</span>
                )}
              </span>
              <input className={inputClass} disabled={disabled} value={specialty.name}
                onChange={(e) =>
                  update({
                    specialties: draft.specialties.map((s, i) => (i === index ? { ...s, name: e.target.value } : s)),
                  })
                } />
            </label>
            <label className={labelClass}>
              Licence number
              <input className={inputClass} disabled={disabled} value={specialty.license_number}
                onChange={(e) =>
                  update({
                    specialties: draft.specialties.map((s, i) =>
                      i === index ? { ...s, license_number: e.target.value } : s,
                    ),
                  })
                } />
            </label>
            {canMutate && draft.specialties.length > 1 ? (
              <button type="button" disabled={disabled} className="self-end text-xs text-red-300"
                onClick={() => update({ specialties: draft.specialties.filter((_, i) => i !== index) })}>
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Clinics</h4>
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
              updateClinic(index, { clinic_id: picked.id, name: null });
            }}
            onRemove={
              draft.clinics.length > 1
                ? () => update({ clinics: draft.clinics.filter((_, i) => i !== index) })
                : undefined
            }
          />
        ))}
      </div>

      <div className="space-y-2 rounded-lg border border-slate-800 p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Directory listing</h4>
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
                  placeholder="https://www.mydoccy.com/en/…"
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
      </div>

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
    <div className="space-y-2 rounded-lg border border-slate-800 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">
          Clinic {index + 1}
          {index === 0 ? " (primary)" : ""} ·{" "}
          {clinic.clinic_id ? "existing DocCy clinic" : "new clinic (created on approval)"}
        </span>
        {canMutate && onRemove ? (
          <button type="button" disabled={disabled} onClick={onRemove} className="text-xs text-red-300">
            Remove
          </button>
        ) : null}
      </div>
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
          <label className={labelClass}>
            Address
            <input className={inputClass} disabled={disabled} value={clinic.address}
              onChange={(e) => onChange({ address: e.target.value })} />
          </label>
          <label className={labelClass}>
            District
            <select className={inputClass} disabled={disabled} value={clinic.district}
              onChange={(e) => onChange({ district: e.target.value })}>
              {CYPRUS_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Town
            <input className={inputClass} disabled={disabled} value={clinic.town ?? ""}
              onChange={(e) => onChange({ town: e.target.value || null })} />
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
    </div>
  );
}
