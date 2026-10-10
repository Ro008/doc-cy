"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { BusyLabel } from "@/components/dashboard/settings/BusyLabel";
import {
  SETTINGS_GHOST_BUTTON_CLASS,
  SETTINGS_LINK_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/settings/styles";
import {
  backendPendingPreviewMessage,
  isBackendPending,
  settingsActionErrorMessage,
} from "@/lib/settings-backend-pending";
import { validateNameChangeRequest } from "@/lib/settings-profile-details";

export type PendingNameChange = { name: string; createdAt: string };

const INPUT_CLASS =
  "mt-1.5 w-full rounded-xl border bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:ring-2";
const INPUT_OK = "border-slate-700 focus:border-clinical-400/60 focus:ring-clinical-400/30";
const INPUT_BAD = "border-red-400/70 focus:border-red-400 focus:ring-red-400/25";

function requestDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Her name on the Profile tab (user, 2026-10-10): read-only, changed by request, since
 * founders checked it at registration (a marriage, or a name scraped wrongly). She types
 * the new name and, if she likes, why; DocCy reviews it. One request at a time, shown as
 * "in review" with a way to cancel it.
 * Contract (backend pending): POST /api/name-change-requests { name, reason } →
 * { request: { createdAt } }; DELETE /api/name-change-requests cancels the pending one.
 */
export function ProfileNameField({
  name,
  initialPending = null,
}: {
  name: string;
  initialPending?: PendingNameChange | null;
}) {
  const nameId = React.useId();
  const reasonId = React.useId();
  const errorId = React.useId();
  const [pending, setPending] = React.useState<PendingNameChange | null>(initialPending);
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
      // EXPECTED TO FAIL until the backend exists (lib/settings-backend-pending.ts): the
      // request then shows for this visit only, and the toast says so.
      const res = await fetch("/api/name-change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: check.name, reason: reason.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !isBackendPending(res.status)) {
        toast.error(settingsActionErrorMessage("requestNameChange", res.status, data, "Could not send the request."));
        return;
      }
      setPending({ name: check.name, createdAt: String(data?.request?.createdAt ?? new Date().toISOString()) });
      setEditing(false);
      if (res.ok) toast.success("Request sent. We’ll email you once it’s reviewed.");
      else toast.warning(backendPendingPreviewMessage("requestNameChange"));
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
      if (!res.ok && !isBackendPending(res.status)) {
        toast.error(settingsActionErrorMessage("cancelNameChange", res.status, data, "Could not cancel the request."));
        return;
      }
      setPending(null);
      if (res.ok) toast.success("Request cancelled.");
    } catch (err) {
      console.error(err);
      toast.error("Could not cancel the request.");
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
          <span className="font-semibold">Name change in review</span>
          <span className="min-w-0 flex-1 text-amber-100/80">
            Requested {requestDate(pending.createdAt)} · “{pending.name}”
          </span>
          <button
            type="button"
            onClick={() => void cancelRequest()}
            disabled={cancelling}
            aria-busy={cancelling}
            className="text-sm font-semibold text-amber-200 underline-offset-4 transition hover:text-amber-50 hover:underline disabled:opacity-60 aria-busy:cursor-progress"
          >
            <BusyLabel busy={cancelling} busyText="Cancelling…">
              Cancel request
            </BusyLabel>
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
            DocCy checks the new name against your registration before it goes live, and emails you.
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
