"use client";

import * as React from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { BusyLabel } from "@/components/dashboard/settings/BusyLabel";
import {
  SettingsDialog,
  dialogDangerButtonClass,
  dialogSecondaryButtonClass,
} from "@/components/dashboard/settings/SettingsDialog";
import { SETTINGS_LINK_CLASS, SETTINGS_SECONDARY_BUTTON_CLASS } from "@/components/dashboard/settings/styles";
import { useDismissibleDenial } from "@/components/dashboard/settings/useDismissibleDenial";
import { profileChangeRequestDate, type DeniedProfileChange } from "@/lib/profile-change-requests";

export type PendingPhotoChange = { createdAt: string; photoUrl: string | null };

/**
 * The photo's buttons and request status on the Profile tab (user, 2026-10-10). A new
 * photo needs a founder: while the request is open the card shows the photo she sent,
 * when she sent it, and "Withdraw request"; the live photo stays. A denial's reason
 * shows until she dismisses it or sends another photo. Removing the photo is immediate.
 * POST /api/photo-change-requests (sent by the crop dialog in SettingsForm),
 * DELETE /api/photo-change-requests withdraws, DELETE /api/professional-photo removes.
 */
export function ProfilePhotoControls({
  hasPhoto,
  uploading,
  onPickFile,
  pending,
  onPendingChange,
  initialDenied = null,
  onRemoved,
}: {
  hasPhoto: boolean;
  uploading: boolean;
  onPickFile: () => void;
  pending: PendingPhotoChange | null;
  onPendingChange: (next: PendingPhotoChange | null) => void;
  initialDenied?: DeniedProfileChange | null;
  onRemoved: () => void;
}) {
  const [denied, dismissDenied] = useDismissibleDenial("photo", initialDenied);
  const [withdrawing, setWithdrawing] = React.useState(false);
  const [confirmingRemove, setConfirmingRemove] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  async function withdraw() {
    setWithdrawing(true);
    try {
      const res = await fetch("/api/photo-change-requests", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.message === "string" ? data.message : "Could not withdraw the request.");
        return;
      }
      onPendingChange(null);
      toast.success("Request withdrawn. Your photo stays as it is.");
    } catch (err) {
      console.error(err);
      toast.error("Could not withdraw the request.");
    } finally {
      setWithdrawing(false);
    }
  }

  async function remove(): Promise<boolean> {
    setRemoving(true);
    try {
      const res = await fetch("/api/professional-photo", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.message === "string" ? data.message : "Could not remove the photo.");
        return false;
      }
      onRemoved();
      toast.success("Photo removed from your profile.");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Could not remove the photo.");
      return false;
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <div className="flex shrink-0 flex-col items-end gap-1.5" data-testid="settings-photo-controls">
        {pending ? null : (
          <button
            type="button"
            onClick={onPickFile}
            disabled={uploading}
            aria-busy={uploading}
            className={SETTINGS_SECONDARY_BUTTON_CLASS}
          >
            <BusyLabel busy={uploading} busyText="Sending…">
              Upload new photo
            </BusyLabel>
          </button>
        )}
        {hasPhoto ? (
          <button type="button" onClick={() => setConfirmingRemove(true)} className={SETTINGS_LINK_CLASS}>
            Remove photo
          </button>
        ) : null}
      </div>

      {pending ? (
        <div
          data-testid="settings-photo-change-pending"
          className="order-last flex basis-full flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] px-3.5 py-2.5 text-sm text-amber-100"
        >
          {pending.photoUrl ? (
            <img
              src={pending.photoUrl}
              alt="The photo you sent"
              className="h-10 w-10 shrink-0 rounded-full border border-amber-300/30 object-cover"
            />
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="font-semibold">New photo sent on {profileChangeRequestDate(pending.createdAt)}</span>
            <span className="text-amber-100/80"> · waiting for DocCy’s approval</span>
          </span>
          <button
            type="button"
            onClick={() => void withdraw()}
            disabled={withdrawing}
            aria-busy={withdrawing}
            className="text-sm font-semibold text-amber-200 underline-offset-4 transition hover:text-amber-50 hover:underline disabled:opacity-60 aria-busy:cursor-progress"
          >
            <BusyLabel busy={withdrawing} busyText="Withdrawing…">
              Withdraw request
            </BusyLabel>
          </button>
        </div>
      ) : null}

      {denied && !pending ? (
        <div
          data-testid="settings-photo-change-denied"
          className="order-last flex basis-full items-start gap-3 rounded-2xl border border-red-400/25 bg-red-500/[0.06] px-3.5 py-2.5 text-sm text-red-100"
        >
          <p className="min-w-0 flex-1">
            <span className="font-semibold">Your new photo was not approved</span>
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

      {confirmingRemove ? (
        <SettingsDialog
          title="Remove your photo?"
          description="Your profile will show no photo, right away. Adding one again needs DocCy’s approval."
          onClose={() => setConfirmingRemove(false)}
          busy={removing}
          footer={(close) => (
            <>
              <button type="button" onClick={close} disabled={removing} className={dialogSecondaryButtonClass}>
                Keep photo
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (await remove()) close();
                }}
                disabled={removing}
                aria-busy={removing}
                className={dialogDangerButtonClass}
              >
                <BusyLabel busy={removing} busyText="Removing…">
                  Remove photo
                </BusyLabel>
              </button>
            </>
          )}
        />
      ) : null}
    </>
  );
}
