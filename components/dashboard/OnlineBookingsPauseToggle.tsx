"use client";

import * as React from "react";
import { toast } from "sonner";
import { formatCyprusPhoneDisplay } from "@/lib/phone-link";
import { CONTACT_PHONE_REQUIRED_CODE } from "@/lib/booking-contact-phone";

export function OnlineBookingsPauseToggle({
  initialPaused,
  locationId,
  onPausedChange,
  contactCallNumber = "",
  phoneRequiredNow = false,
  pausingRequiresPhone = false,
  onSaveContactPhone,
}: {
  initialPaused: boolean;
  locationId?: string | null;
  onPausedChange?: (paused: boolean, details?: { showPhonePublic?: boolean }) => void;
  /** The number patients see today; "" when the account has none. */
  contactCallNumber?: string;
  /** Right now at least one clinic takes no online bookings. */
  phoneRequiredNow?: boolean;
  /** Pausing this clinic would leave its patients with the phone as their only way in. */
  pausingRequiresPhone?: boolean;
  onSaveContactPhone?: (phone: string) => Promise<boolean>;
}) {
  const [paused, setPaused] = React.useState(initialPaused);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = React.useState("");
  const [phoneSaving, setPhoneSaving] = React.useState(false);
  const [promptOpen, setPromptOpen] = React.useState(false);

  React.useEffect(() => {
    setPaused(initialPaused);
  }, [initialPaused]);

  const hasContactNumber = contactCallNumber.trim().length > 0;
  // Already unreachable: a paused clinic and no number. Keep asking until it is fixed.
  const strandedNow = phoneRequiredNow && !hasContactNumber;
  const contactPhonePrompt = promptOpen || strandedNow;

  async function setPausedRemote(next: boolean) {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/doctor-online-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pauseOnlineBookings: next,
          ...(locationId ? { locationId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === CONTACT_PHONE_REQUIRED_CODE) {
          setPromptOpen(true);
          setPaused(!next);
          return;
        }
        const message = (data?.message as string) || "Failed to update setting.";
        setError(message);
        toast.error(message);
        setPaused(!next);
        return;
      }
      setPaused(next);
      onPausedChange?.(next, { showPhonePublic: Boolean(data?.showPhonePublic) });
      setPromptOpen(false);
      const revealed = String(data?.callNumber ?? "").trim();
      toast.success(
        next
          ? revealed
            ? `Online bookings paused. Patients will see ${formatCyprusPhoneDisplay(revealed)}.`
            : "Online bookings paused."
          : "Online bookings resumed.",
      );
    } catch (e) {
      console.error(e);
      const message = "Something went wrong.";
      setError(message);
      toast.error(message);
      setPaused(!next);
    } finally {
      setSaving(false);
    }
  }

  function handleToggle() {
    const next = !paused;
    // Never close a clinic's online path without leaving its patients a number to call.
    if (next && pausingRequiresPhone && !hasContactNumber) {
      setPromptOpen(true);
      return;
    }
    void setPausedRemote(next);
  }

  async function handleSavePhone() {
    if (!onSaveContactPhone) return;
    setPhoneSaving(true);
    try {
      const ok = await onSaveContactPhone(phoneDraft);
      if (!ok) return;
      setPhoneDraft("");
      setPromptOpen(false);
      if (!paused) await setPausedRemote(true);
    } finally {
      setPhoneSaving(false);
    }
  }

  const accepting = !paused;
  const switchId = React.useId();

  const track = accepting ? "bg-clinical-500/90" : "bg-slate-600";

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 px-4 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Online bookings
          </p>
          <p
            className={`mt-0 text-xs font-medium leading-tight ${
              accepting ? "text-clinical-200" : "text-amber-200/95"
            }`}
          >
            {accepting ? "Accepting appointments" : "Paused"}
          </p>
        </div>
        <button
          id={switchId}
          type="button"
          role="switch"
          aria-checked={accepting}
          aria-busy={saving}
          disabled={saving}
          onClick={handleToggle}
          className={`relative h-7 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 disabled:opacity-50 ${track}`}
        >
          <span
            className={`absolute left-0.5 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${
              accepting ? "translate-x-[1.125rem]" : "translate-x-0"
            }`}
            aria-hidden
          />
          <span className="sr-only">
            {accepting ? "Pause online bookings" : "Resume online bookings"}
          </span>
        </button>
      </div>

      {!contactPhonePrompt && hasContactNumber && phoneRequiredNow ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Patients cannot book online at this clinic, so your profile shows{" "}
          <span className="font-semibold text-slate-200">
            {formatCyprusPhoneDisplay(contactCallNumber)}
          </span>{" "}
          for them to call.{" "}
          <a
            href="#phone-numbers"
            className="font-medium text-clinical-300 underline-offset-2 hover:underline"
          >
            Change number
          </a>
        </p>
      ) : null}

      {!contactPhonePrompt && hasContactNumber && accepting && pausingRequiresPhone ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          If you pause, patients will see{" "}
          <span className="font-semibold text-slate-200">
            {formatCyprusPhoneDisplay(contactCallNumber)}
          </span>{" "}
          so they can call you instead.
        </p>
      ) : null}

      {contactPhonePrompt ? (
        <div className="mt-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3">
          <p className="text-sm font-medium text-amber-100">
            {strandedNow
              ? "Patients cannot reach you at this clinic"
              : "Patients need a way to reach you"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/90">
            With online bookings paused here, patients can only reach you by phone. Add
            the number they should call and we will show it on your profile.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="tel"
              autoComplete="tel"
              value={phoneDraft}
              onChange={(e) => setPhoneDraft(e.target.value)}
              placeholder="+357..."
              aria-label="Phone number patients should call"
              className="w-full rounded-xl border border-amber-500/30 bg-ink-900/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
            />
            <button
              type="button"
              onClick={() => void handleSavePhone()}
              disabled={phoneSaving || saving || phoneDraft.trim().length === 0}
              className="shrink-0 rounded-xl bg-amber-400/90 px-3 py-2 text-sm font-semibold text-ink-900 transition hover:bg-amber-300 disabled:opacity-60"
            >
              {phoneSaving || saving
                ? "Saving..."
                : strandedNow
                  ? "Save number"
                  : "Save and pause"}
            </button>
          </div>
          {!strandedNow ? (
            <button
              type="button"
              onClick={() => {
                setPromptOpen(false);
                setPhoneDraft("");
              }}
              className="mt-2 text-xs font-medium text-amber-100/80 hover:text-amber-50"
            >
              Keep taking online bookings
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs text-red-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
