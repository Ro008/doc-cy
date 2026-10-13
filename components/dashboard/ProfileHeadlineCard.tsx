"use client";

import * as React from "react";
import { toast } from "sonner";
import { BusyLabel } from "@/components/dashboard/settings/BusyLabel";
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_EYEBROW_CLASS,
  SETTINGS_GHOST_BUTTON_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/settings/styles";
import {
  PROFILE_HEADLINE_MAX_LENGTH,
  normalizeProfileHeadline,
  profileHeadlineError,
} from "@/lib/profile-headline";
import { saveProfileCustomization, type ProfileCustomization } from "@/lib/profile-customization";

type Props = {
  initial: ProfileCustomization;
};


/**
 * Settings › Profile › "Headline": the optional line under her name on the public page.
 * The page's colour is DocCy's and light/dark is the visitor's choice, so there is
 * nothing else to pick here (user, 2026-10-13). Each change is recorded, at most 5 in
 * 30 days; saved, failed and "too often" are toasts (settings loading rules).
 */
export function ProfileHeadlineCard({ initial }: Props) {
  // What is saved now: starts as the page's value, moves on after each successful save.
  const [saved, setSaved] = React.useState<string | null>(initial.headline);
  const [headline, setHeadline] = React.useState(initial.headline ?? "");
  const [saving, setSaving] = React.useState(false);

  const headlineTooLong = profileHeadlineError(headline) === "too_long";
  const shownHeadline = normalizeProfileHeadline(headline);
  const dirty = (shownHeadline ?? null) !== (saved ?? null);

  const onSave = async () => {
    setSaving(true);
    const result = await saveProfileCustomization({ headline });
    setSaving(false);
    if (!("reason" in result)) {
      setSaved(shownHeadline);
      setHeadline(shownHeadline ?? "");
      toast.success("Saved. Your page uses it now.", { id: "profile-page" });
      return;
    }
    toast.error(
      result.reason === "too_often"
        ? result.message
        : result.reason === "invalid"
          ? `Keep the headline under ${PROFILE_HEADLINE_MAX_LENGTH} characters.`
          : "Could not save. Please try again.",
      { id: "profile-page" },
    );
  };

  return (
    <section data-testid="settings-headline" className={SETTINGS_CARD_CLASS}>
      <fieldset disabled={saving} className="min-w-0">
        <label htmlFor="profile-headline" className={SETTINGS_EYEBROW_CLASS}>
          Headline <span className="font-normal normal-case tracking-normal text-slate-400">(optional)</span>
        </label>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          One line under your name on your public page, in your own words.
        </p>
        <input
          id="profile-headline"
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="e.g. Skin care for the whole family"
          aria-invalid={headlineTooLong}
          aria-describedby="profile-headline-count"
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-clinical-400/60 focus:ring-2 focus:ring-clinical-400/30"
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {dirty ? (
            <>
              <button
                type="button"
                data-testid="settings-headline-save"
                onClick={onSave}
                disabled={headlineTooLong || saving}
                aria-busy={saving}
                className={SETTINGS_PRIMARY_BUTTON_CLASS}
              >
                <BusyLabel busy={saving} busyText="Saving…">
                  Save headline
                </BusyLabel>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setHeadline(saved ?? "")}
                className={SETTINGS_GHOST_BUTTON_CLASS}
              >
                Cancel
              </button>
            </>
          ) : null}
          <p
            id="profile-headline-count"
            className={`ml-auto text-[11px] tabular-nums ${headlineTooLong ? "font-semibold text-red-300" : "text-slate-500"}`}
          >
            {headline.replace(/\s+/g, " ").trim().length}/{PROFILE_HEADLINE_MAX_LENGTH}
          </p>
        </div>
      </fieldset>
    </section>
  );
}
