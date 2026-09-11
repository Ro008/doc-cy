"use client";

import * as React from "react";
import Link from "next/link";
import { LanguageBadgeList } from "@/components/languages/LanguageBadgeList";
import { useDirectoryNav } from "@/components/internal/DirectoryNavContext";
import {
  isSpecialtyResolvedForVerification,
  verificationBlockedReason,
} from "@/lib/doctor-specialty-public";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import { stripPlusCodePrefix } from "@/lib/clinic-location-pin";
import type { PendingRegistrationReviewItem } from "@/lib/pending-registration-review";
import type { PendingRegistrationOriginKind } from "@/lib/pending-registration-origin";

async function postVerification(doctorId: string, action: "verify" | "reject") {
  const res = await fetch("/api/internal/doctors/verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ doctorId, action }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { message?: string }).message ?? res.statusText);
  }
}

async function postTwinAction(
  registeredId: string,
  action: "absorb" | "keep_both",
  options: { unregisteredId?: string; listingUrl?: string },
) {
  const res = await fetch("/api/internal/pending-registration-twin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      registeredId,
      action,
      unregisteredId: options.unregisteredId,
      listingUrl: options.listingUrl,
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { message?: string }).message ?? res.statusText);
  }
}

function formatCoords(lat: number | null, lng: number | null): string | null {
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function originBadgeClass(kind: PendingRegistrationOriginKind): string {
  switch (kind) {
    case "claimed_listing":
      return "bg-clinical-500/15 text-clinical-200";
    case "auto_matched_listing":
      return "bg-sky-500/15 text-sky-200";
    case "possible_twin":
      return "bg-violet-500/15 text-violet-200";
    case "unclaimed_review":
      return "bg-amber-500/15 text-amber-100";
  }
}

export function PendingRegistrationReviewPanel({
  items,
}: {
  items: PendingRegistrationReviewItem[];
}) {
  const { canMutate } = useDirectoryNav();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [busyLabel, setBusyLabel] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [listingUrlById, setListingUrlById] = React.useState<Record<string, string>>({});

  if (items.length === 0) return null;

  async function finishWithReload(message: string) {
    setSuccess(message);
    setBusyLabel("Reloading dashboard…");
    // Soft refresh often feels hung on this page (large directory twin scan).
    // Hard reload gives clear completion feedback.
    window.location.reload();
  }

  async function runAction(doctorId: string, action: "verify" | "reject") {
    setError(null);
    setSuccess(null);
    setBusyId(doctorId);
    setBusyLabel(action === "verify" ? "Verifying…" : "Rejecting…");
    try {
      await postVerification(doctorId, action);
      await finishWithReload(
        action === "verify"
          ? "Professional verified. Reloading…"
          : "License rejected. Reloading…",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setBusyId(null);
      setBusyLabel(null);
    }
  }

  async function runTwinAction(
    registeredId: string,
    action: "absorb" | "keep_both",
    options: { unregisteredId?: string; listingUrl?: string },
  ) {
    const key = options.unregisteredId
      ? `${registeredId}:${options.unregisteredId}:${action}`
      : `${registeredId}:url:${action}`;
    setError(null);
    setSuccess(null);
    setBusyId(key);
    setBusyLabel(action === "absorb" ? "Absorbing listing…" : "Saving keep both…");
    try {
      await postTwinAction(registeredId, action, options);
      setListingUrlById((prev) => {
        const next = { ...prev };
        delete next[registeredId];
        return next;
      });
      await finishWithReload(
        action === "absorb"
          ? "Finder listing absorbed into this registration. Reloading…"
          : "Kept both profiles. Reloading…",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setBusyId(null);
      setBusyLabel(null);
    }
  }

  return (
    <section
      id="pending-registration-review"
      className="scroll-mt-24 space-y-4 rounded-2xl border border-amber-500/35 bg-slate-950/40 p-5"
      aria-busy={Boolean(busyId)}
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
          Registration review
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-100">
          Pending applications ({items.length})
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Everything the professional submitted at signup — photo, contact,
          specialties, licenses, and clinic locations. Origin labels show whether
          they claimed a finder card, were auto-matched, look like a twin, or need
          an unclaimed review.
        </p>
      </div>

      {busyLabel ? (
        <p
          className="rounded-xl border border-clinical-500/40 bg-clinical-500/10 px-3 py-2 text-sm text-clinical-100"
          role="status"
          aria-live="polite"
        >
          {busyLabel}
        </p>
      ) : null}
      {success ? (
        <p
          className="rounded-xl border border-clinical-500/40 bg-clinical-500/10 px-3 py-2 text-sm text-clinical-100"
          role="status"
          aria-live="polite"
        >
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        {items.map((item) => {
          const busy = busyId === item.id || Boolean(busyId?.startsWith(`${item.id}:`));
          const specialtyResolved = isSpecialtyResolvedForVerification({
            is_specialty_approved: item.isSpecialtyApproved,
            specialty_requires_standard_at: item.specialtyRequiresStandardAt,
          });
          const canVerify = canMutate && specialtyResolved;
          const blockReason = !specialtyResolved
            ? verificationBlockedReason({
                is_specialty_approved: item.isSpecialtyApproved,
                specialty_requires_standard_at: item.specialtyRequiresStandardAt,
              })
            : null;
          const proofHref = item.licenseFileUrl
            ? `/api/internal/doctors/${item.id}/license`
            : null;
          const specialtyRows =
            item.specialties.length > 0
              ? item.specialties
              : item.primarySpecialty
                ? [
                    {
                      id: null,
                      specialty: item.primarySpecialty,
                      licenseNumber: item.primaryLicenseNumber,
                      isApproved: item.isSpecialtyApproved,
                    },
                  ]
                : [];

          return (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-800/90 bg-slate-900/50 p-4 sm:p-5"
            >
              <div className="flex flex-col gap-5 lg:flex-row">
                <div className="shrink-0">
                  {item.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- founder dashboard; storage URL may vary by env
                    <img
                      src={item.avatarUrl}
                      alt={`Photo of ${item.name}`}
                      width={112}
                      height={112}
                      className="h-28 w-28 rounded-2xl object-cover ring-1 ring-slate-700"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-slate-800 text-xs font-medium text-slate-500 ring-1 ring-slate-700">
                      No photo
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-50">
                        {item.name}
                      </h3>
                      {item.createdAt ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          Submitted{" "}
                          {new Date(item.createdAt).toLocaleString("en-GB", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      ) : null}
                      <span
                        className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${originBadgeClass(item.originKind)}`}
                        title={item.originDescription}
                      >
                        {item.originLabel}
                      </span>
                      <p className="mt-1 max-w-xl text-[11px] leading-snug text-slate-500">
                        {item.originDescription}
                      </p>
                    </div>
                    {item.slug ? (
                      <Link
                        href={publicProfessionalProfilePath(item.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-clinical-300 hover:underline"
                      >
                        Public profile ↗
                      </Link>
                    ) : null}
                  </div>

                  {item.originKind === "possible_twin" && item.twins.length > 0 ? (
                    <div className="rounded-xl border border-violet-400/30 bg-violet-500/10 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-200/90">
                        Similar finder listings
                      </p>
                      <ul className="mt-2 space-y-2">
                        {item.twins.map((twin) => {
                          const twinBusy =
                            busyId === `${item.id}:${twin.id}:absorb` ||
                            busyId === `${item.id}:${twin.id}:keep_both`;
                          return (
                            <li
                              key={twin.id}
                              className="rounded-lg border border-violet-300/20 bg-slate-950/40 px-3 py-2"
                            >
                              <p className="text-sm text-slate-100">
                                <span className="font-semibold">{twin.name}</span>
                                {" · "}
                                {twin.specialty ?? "—"}
                                {" · "}
                                {twin.district ?? "—"}
                              </p>
                              <p className="mt-0.5 text-[11px] text-violet-200/85">
                                Score {(twin.score * 100).toFixed(0)}% · {twin.reason}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {twin.slug ? (
                                  <Link
                                    href={publicProfessionalProfilePath(twin.slug)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-lg border border-slate-600 bg-slate-800/40 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-slate-500"
                                  >
                                    Open listing ↗
                                  </Link>
                                ) : null}
                                {canMutate ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={busy || twinBusy}
                                      onClick={() =>
                                        void runTwinAction(item.id, "absorb", {
                                          unregisteredId: twin.id,
                                        })
                                      }
                                      className="rounded-lg bg-clinical-500/20 px-2.5 py-1 text-[11px] font-semibold text-clinical-100 ring-1 ring-clinical-500/35 transition hover:bg-clinical-500/30 disabled:opacity-50"
                                    >
                                      {busyId === `${item.id}:${twin.id}:absorb`
                                        ? "Absorbing…"
                                        : "Absorb into this registration"}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={busy || twinBusy}
                                      onClick={() =>
                                        void runTwinAction(item.id, "keep_both", {
                                          unregisteredId: twin.id,
                                        })
                                      }
                                      className="rounded-lg bg-slate-700/60 px-2.5 py-1 text-[11px] font-semibold text-slate-100 ring-1 ring-slate-500/40 transition hover:bg-slate-700/80 disabled:opacity-50"
                                    >
                                      {busyId === `${item.id}:${twin.id}:keep_both`
                                        ? "Saving…"
                                        : "Keep both"}
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}

                  {item.originKind === "unclaimed_review" ||
                  (item.originKind === "possible_twin" && item.twins.length === 0) ? (
                    <div
                      className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3"
                      data-testid="pending-manual-listing-link"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
                        Link a finder listing manually
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-slate-400">
                        If you know this person already exists in the finder, paste their public
                        profile URL and absorb it into this registration.
                      </p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          type="url"
                          value={listingUrlById[item.id] ?? ""}
                          onChange={(e) =>
                            setListingUrlById((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          placeholder="https://…/en/their-slug"
                          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
                        />
                        {canMutate ? (
                          <button
                            type="button"
                            disabled={
                              busy ||
                              busyId === `${item.id}:url:absorb` ||
                              !String(listingUrlById[item.id] ?? "").trim()
                            }
                            onClick={() =>
                              void runTwinAction(item.id, "absorb", {
                                listingUrl: listingUrlById[item.id],
                              })
                            }
                            className="rounded-lg bg-clinical-500/20 px-3 py-1.5 text-xs font-semibold text-clinical-100 ring-1 ring-clinical-500/35 transition hover:bg-clinical-500/30 disabled:opacity-50"
                          >
                            {busyId === `${item.id}:url:absorb`
                              ? "Absorbing…"
                              : "Absorb listing from URL"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Email
                      </dt>
                      <dd className="mt-0.5 break-all text-sm text-slate-200">
                        {item.email?.trim() || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Phone
                      </dt>
                      <dd className="mt-0.5 text-sm text-slate-200">
                        {item.phone?.trim() || "—"}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Languages
                      </dt>
                      <dd className="mt-1">
                        {item.languages.length > 0 ? (
                          <LanguageBadgeList languages={item.languages} compact />
                        ) : (
                          <span className="text-sm text-slate-500">—</span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Specialties & licenses
                    </p>
                    {specialtyRows.length === 0 ? (
                      <p className="mt-1 text-sm text-slate-500">—</p>
                    ) : (
                      <ul className="mt-2 divide-y divide-slate-800/80 rounded-xl border border-slate-800/80">
                        {specialtyRows.map((row) => (
                          <li
                            key={row.id ?? row.specialty}
                            className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm"
                          >
                            <span className="font-medium text-slate-100">
                              {row.specialty}
                            </span>
                            <span className="text-xs text-slate-400">
                              License: {row.licenseNumber?.trim() || "—"}
                              {" · "}
                              <span
                                className={
                                  row.isApproved
                                    ? "text-clinical-300"
                                    : "text-amber-200"
                                }
                              >
                                {row.isApproved ? "Approved" : "Needs review"}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Clinic locations
                    </p>
                    {item.locations.length === 0 ? (
                      <p className="mt-1 text-sm text-slate-500">—</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {item.locations.map((loc, index) => {
                          const address = stripPlusCodePrefix(
                            String(loc.address ?? ""),
                          );
                          const meta = [loc.town, loc.district]
                            .map((v) => String(v ?? "").trim())
                            .filter(Boolean)
                            .join(" · ");
                          const coords = formatCoords(
                            loc.latitude,
                            loc.longitude,
                          );
                          return (
                            <li
                              key={loc.id ?? `${item.id}-loc-${index}`}
                              className="rounded-xl border border-slate-800/80 px-3 py-2 text-sm text-slate-200"
                            >
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                {loc.isPrimary
                                  ? "Primary"
                                  : `Location ${index + 1}`}
                              </p>
                              <p className="mt-0.5 whitespace-pre-wrap break-words">
                                {address || "—"}
                              </p>
                              {meta ? (
                                <p className="mt-0.5 text-xs text-slate-400">
                                  {meta}
                                </p>
                              ) : null}
                              {coords ? (
                                <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                                  {coords}
                                  {loc.placeId ? " · Google place linked" : ""}
                                </p>
                              ) : loc.placeId ? (
                                <p className="mt-0.5 text-[11px] text-slate-500">
                                  Google place linked
                                </p>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-slate-800/80 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
                    {canMutate ? (
                      <>
                        <button
                          type="button"
                          disabled={busy || !canVerify}
                          title={blockReason ?? undefined}
                          onClick={() => void runAction(item.id, "verify")}
                          className="rounded-lg bg-clinical-500/20 px-3 py-1.5 text-xs font-semibold text-clinical-100 ring-1 ring-clinical-500/35 transition hover:bg-clinical-500/30 disabled:opacity-50"
                        >
                          {busyId === item.id && busyLabel?.startsWith("Verif")
                            ? "Verifying…"
                            : "Verify professional"}
                        </button>
                        <button
                          type="button"
                          disabled={busy || !canVerify}
                          title={blockReason ?? undefined}
                          onClick={() => void runAction(item.id, "reject")}
                          className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-100 ring-1 ring-red-500/35 transition hover:bg-red-500/25 disabled:opacity-50"
                        >
                          {busyId === item.id && busyLabel?.startsWith("Reject")
                            ? "Rejecting…"
                            : "Reject license"}
                        </button>
                      </>
                    ) : null}
                    {blockReason ? (
                      <p className="text-[11px] leading-snug text-amber-200/90">
                        {blockReason}
                      </p>
                    ) : null}
                    {proofHref ? (
                      <a
                        href={proofHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-800/40 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500"
                      >
                        View ID proof
                      </a>
                    ) : (
                      <span className="text-xs text-slate-600">No ID file</span>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
