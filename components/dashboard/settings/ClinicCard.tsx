"use client";

import * as React from "react";
import { ChevronDown, Lock } from "lucide-react";
import type { ClinicBookingStatus } from "@/lib/settings-clinic-summary";
import type { PendingClinicChange } from "@/components/dashboard/settings/ClinicChangeRequestDialog";
import { formatCyprusPhoneDisplay } from "@/lib/phone-link";
import { Collapse } from "@/components/dashboard/settings/Collapse";
import {
  SETTINGS_DANGER_BUTTON_CLASS,
  SETTINGS_LINK_CLASS,
  SETTINGS_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/settings/styles";

const STATUS_PILL: Record<ClinicBookingStatus["kind"], string> = {
  ended: "bg-slate-500/20 text-slate-300",
  taking: "bg-wellness-500/15 text-wellness-200",
  paused: "border border-dashed border-amber-400/80 text-amber-100",
  holiday: "bg-amber-500/15 text-amber-200",
};

function formatRequestDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function pendingSummary(pending: PendingClinicChange): string {
  const parts: string[] = [];
  if (pending.changes.clinicId) parts.push("move to a DocCy clinic");
  if (pending.changes.name) parts.push(`name “${pending.changes.name}”`);
  if (pending.changes.address) parts.push(`address “${pending.changes.address}”`);
  if (pending.changes.phone) parts.push(`phone ${formatCyprusPhoneDisplay(pending.changes.phone)}`);
  return parts.join(", ");
}

/**
 * One clinic in the Clinics section (design B1). With several clinics the card folds to
 * its header (name, status, the booking switch) and one is open at a time (user,
 * 2026-10-10): every clinic's booking state stays in view, which tabs would hide. A
 * single clinic has nothing to fold.
 */
export function ClinicCard({
  name,
  collapsible,
  open,
  onToggleOpen,
  swatchClass,
  status,
  bookingSwitch,
  address,
  phoneField,
  pendingChange,
  onRequestChange,
  summary,
  editing,
  editLabel,
  onToggleEdit,
  editor,
  limits,
  removal,
  onRemove,
  busy,
}: {
  name: string;
  /** False with a single clinic: the card is always open and its header is not a button. */
  collapsible: boolean;
  open: boolean;
  onToggleOpen: () => void;
  swatchClass: string;
  status: ClinicBookingStatus;
  bookingSwitch: React.ReactNode;
  address: string;
  /** The clinic's phone, with its own "Request phone change" (ClinicPhoneField). */
  phoneField: React.ReactNode;
  pendingChange: PendingClinicChange | null;
  /** null while the clinic is still being set up (its address is set in the editor). */
  onRequestChange: (() => void) | null;
  summary: { days: string; hours: string; breakTime: string; slot: string };
  editing: boolean;
  /** What the editor holds, e.g. "Edit hours and slots" or "Set address and hours". */
  editLabel: string;
  onToggleEdit: () => void;
  editor: React.ReactNode;
  /** This clinic's booking limits (how far ahead, notice, online cancellation). */
  limits: React.ReactNode;
  removal: { ok: true } | { ok: false; message: string };
  onRemove: () => void;
  busy: boolean;
}) {
  const stats: Array<[string, string]> = [
    ["Days", summary.days],
    ["Hours", summary.hours],
    ["Break", summary.breakTime],
    ["Slot", summary.slot],
  ];
  const bodyId = React.useId();
  const shown = !collapsible || open;
  return (
    <section
      data-testid="settings-clinic-card"
      aria-label={name}
      className={`rounded-3xl border bg-slate-900/70 p-5 shadow-xl shadow-black/20 transition-colors sm:p-6 ${
        shown ? "border-slate-700/70" : "border-slate-800 hover:border-slate-700"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        {collapsible ? (
          <h2 className="min-w-0 flex-1 basis-full sm:basis-0">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={onToggleOpen}
              className="group -m-1.5 flex w-[calc(100%+0.75rem)] min-w-0 items-center gap-3 rounded-xl p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/60"
            >
              <span className={`h-3 w-3 shrink-0 rounded-[4px] ${swatchClass}`} aria-hidden />
              <span className="min-w-0 truncate text-[17px] font-semibold text-slate-50">{name}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-slate-200 ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
              {open ? null : (
                <span className="hidden min-w-0 truncate text-xs font-normal text-slate-400 lg:inline" aria-hidden>
                  {summary.days} · {summary.hours}
                </span>
              )}
            </button>
          </h2>
        ) : (
          <>
            <span className={`h-3 w-3 shrink-0 rounded-[4px] ${swatchClass}`} aria-hidden />
            <h2 className="min-w-0 flex-1 basis-[calc(100%-1.5rem)] truncate text-[17px] font-semibold text-slate-50 sm:basis-0">
              {name}
            </h2>
          </>
        )}
        {pendingChange && !shown ? (
          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
            Change in review
          </span>
        ) : null}
        <span
          className={`mr-auto rounded-full px-2.5 py-1 text-[11px] font-semibold sm:mr-0 ${STATUS_PILL[status.kind]}`}
        >
          {status.label}
        </span>
        {bookingSwitch}
      </div>

      <Collapse open={shown}>
        <div id={bodyId}>
          {pendingChange ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] px-3.5 py-2.5 text-sm text-amber-100">
              <span className="font-semibold">Change in review</span>
              <span className="text-amber-100/80">
                Requested {formatRequestDate(pendingChange.createdAt)} · {pendingSummary(pendingChange)}
              </span>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-300">
            <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            <span className={`min-w-[12rem] flex-1 ${address ? "" : "text-amber-200"}`}>
              {address || "No address yet"}
            </span>
            {onRequestChange && !pendingChange ? (
              <button
                type="button"
                onClick={onRequestChange}
                className={SETTINGS_LINK_CLASS}
              >
                {address ? "Request name or address change" : "Request your address"}
              </button>
            ) : null}
          </div>
          {phoneField}

          <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
                <dd
                  data-testid={`settings-clinic-${label.toLowerCase()}-summary`}
                  className="mt-1 text-sm font-medium text-slate-100"
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {limits}

          <Collapse open={editing}>
            <div className="mt-5 border-t border-white/10 pt-5">{editor}</div>
          </Collapse>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {/* While open, the editor has its own Save hours / Cancel. */}
            {editing ? (
              <span />
            ) : (
              <button
                type="button"
                onClick={onToggleEdit}
                aria-expanded={false}
                className={SETTINGS_SECONDARY_BUTTON_CLASS}
              >
                {editLabel}
                <ChevronDown className="h-4 w-4" aria-hidden />
              </button>
            )}
            {removal.ok === false ? (
              <p className="text-xs text-slate-400">{removal.message}</p>
            ) : (
              <button
                type="button"
                onClick={onRemove}
                disabled={busy}
                className={SETTINGS_DANGER_BUTTON_CLASS}
              >
                Remove clinic
              </button>
            )}
          </div>
        </div>
      </Collapse>
    </section>
  );
}
