"use client";

import * as React from "react";
import { Lock, X } from "lucide-react";
import { toast } from "sonner";
import { BusyLabel } from "@/components/dashboard/settings/BusyLabel";
import {
  SETTINGS_GHOST_BUTTON_CLASS,
  SETTINGS_LINK_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/settings/styles";
import { useDismissibleDenial } from "@/components/dashboard/settings/useDismissibleDenial";
import {
  profileChangeRequestDate,
  type DeniedProfileChange,
  type PendingProfileChange,
} from "@/lib/profile-change-requests";
import { validateNameChangeRequest } from "@/lib/settings-profile-details";

export type PendingNameChange = Pick<PendingProfileChange, "name" | "createdAt">;

const INPUT_CLASS =
  "mt-1.5 w-full rounded-xl border bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:ring-2";
const INPUT_OK = "border-slate-700 focus:border-clinical-400/60 focus:ring-clinical-400/30";
const INPUT_BAD = "border-red-400/70 focus:border-red-400 focus:ring-red-400/25";

/**
 * Her name on the Profile tab (user, 2026-10-10): read-only, changed by request, since
 * founders checked it at registration (a marriage, or a name scraped wrongly). She types
 * the new name and, if she likes, why; founders approve or deny it. One request at a
 * time: while it is open the page says when it was sent and lets her withdraw it. If
 * her latest request was denied, the reason shows until she dismisses it or asks again.
 * POST /api/name-change-requests { name, reason } → { request: { name, createdAt } };
 * DELETE /api/name-change-requests withdraws the open one.
 */
export function ProfileNameField({
  name,
  initialPending = null,
  initialDenied = null,
}: {
  name: string;
  initialPending?: PendingNameChange | null;
  initialDenied?: DeniedProfileChange | null;
}) {
  const nameId = React.useId();
  const reasonId = React.useId();
  const errorId = React.useId();
  const [pending, setPending] = React.useState<PendingNameChange | null>(initialPending);
  const [denied, dismissDenied, clearDenied] = useDismissibleDenial("name", initialDenied);
  const [editing, setEditing] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);

  const open = () => {
    setTyped(name);
    setReason("");
    setError(null);
    setEditing(true);
  };

  async function send() {
    const check = validateNameChangeRequest(name, typed);
    if (check.ok === false) {
      setError(check.message);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/name-change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: check.name, reason: reason.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.message === "string" ? data.message : "Could not send the request.");
        return;
      }
      setPending({
        name: String(data?.request?.name ?? check.name),
        createdAt: String(data?.request?.createdAt ?? new Date().toISOString()),
      });
      clearDenied();
      setEditing(false);
      toast.success("Request sent. We’ll email you once DocCy has reviewed it.");
    } catch (err) {
      console.error(err);
      toast.error("Could not send the request.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest() {
    setCancelling(true);
    try {
      const res = await fetch("/api/name-change-requests", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.message === "string" ? data.message : "Could not withdraw the request.");
        return;
      }
      setPending(null);
      toast.success("Request withdrawn. Your name stays as it is.");
    } catch (err) {
      console.error(err);
      toast.error("Could not withdraw the request.");
    } finally {
      setCancelling(false);
    }
  }

  // Two flex items of the card's row: the name beside the photo, and (last, full width)
  // the request or its form under both.
  return (
    <>
      <div className="min-w-0 flex-1" data-testid="settings-profile-name">
        <div className="flex items-center gap-2">
          <p className="min-w-0 truncate text-[17px] font-semibold text-slate-50">{name}</p>
          <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        </div>
        {pending || editing ? null : (
          <button type="button" onClick={open} className={`mt-1 ${SETTINGS_LINK_CLASS}`}>
            Request name change
          </button>
        )}
      </div>
      {pending ? (
        <div
          data-testid="settings-name-change-pending"
          className="order-last flex basis-full flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] px-3.5 py-2.5 text-sm text-amber-100"
        >
          <span className="min-w-0 flex-1">
            <span className="font-semibold">Request sent on {profileChangeRequestDate(pending.createdAt)}</span>
            <span className="text-amber-100/80">
              {" "}
              · waiting for DocCy’s approval · new name “{pending.name}”
            </span>
          </span>
          <button
            type="button"
            onClick={() => void cancelRequest()}
            disabled={cancelling}
            aria-busy={cancelling}
            className="text-sm font-semibold text-amber-200 underline-offset-4 transition hover:text-amber-50 hover:underline disabled:opacity-60 aria-busy:cursor-progress"
          >
            <BusyLabel busy={cancelling} busyText="Withdrawing…">
              Withdraw request
            </BusyLabel>
          </button>
        </div>
      ) : null}

      {denied && !pending ? (
        <div
          data-testid="settings-name-change-denied"
          className="order-last flex basis-full items-start gap-3 rounded-2xl border border-red-400/25 bg-red-500/[0.06] px-3.5 py-2.5 text-sm text-red-100"
        >
          <p className="min-w-0 flex-1">
            <span className="font-semibold">
              Your name change{denied.name ? ` to “${denied.name}”` : ""} was not approved
            </span>
            <span className="text-red-100/80"> on {profileChangeRequestDate(denied.decidedAt)}.</span>
            <span className="mt-0.5 block text-red-100/90">Reason: {denied.reason}</span>
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismissDenied}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-200/80 transition hover:bg-white/5 hover:text-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}

      {editing ? (
        // Not a <form>: the settings page is one already.
        <fieldset
          disabled={busy}
          data-testid="settings-name-change-form"
          className="order-last min-w-0 basis-full space-y-4 rounded-2xl border border-slate-700 bg-slate-950/40 p-4"
        >
          <div>
            <label htmlFor={nameId} className="text-xs font-medium text-slate-300">
              Name as patients should see it <span className="text-red-300">*</span>
            </label>
            <input
              id={nameId}
              type="text"
              autoComplete="off"
              autoFocus
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void send();
                }
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              placeholder="First name and surname"
              className={`${INPUT_CLASS} ${error ? INPUT_BAD : INPUT_OK}`}
            />
            {error ? (
              <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-red-300">
                {error}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-400">Without a title such as Dr or Prof.</p>
            )}
          </div>
          <div>
            <label htmlFor={reasonId} className="text-xs font-medium text-slate-300">
              Why it changed <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id={reasonId}
              type="text"
              maxLength={200}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="For example: I married, or my name is misspelled"
              className={`${INPUT_CLASS} ${INPUT_OK}`}
            />
          </div>
          <p className="text-xs text-slate-400">
            DocCy checks the new name against your registration before it goes live, and emails you the
            decision. Your profile’s web address changes with the name; the old one keeps working.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy}
              aria-busy={busy}
              className={SETTINGS_PRIMARY_BUTTON_CLASS}
            >
              <BusyLabel busy={busy} busyText="Sending…">
                Send request
              </BusyLabel>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
              className={SETTINGS_GHOST_BUTTON_CLASS}
            >
              Cancel
            </button>
          </div>
        </fieldset>
      ) : null}
    </>
  );
}
