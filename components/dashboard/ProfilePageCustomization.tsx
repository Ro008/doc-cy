"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import {
  PROFILE_ACCENTS,
  PROFILE_ACCENT_IDS,
  profileThemeStyle,
  type ProfileAccentId,
} from "@/lib/profile-theme";
import {
  PROFILE_HEADLINE_MAX_LENGTH,
  normalizeProfileHeadline,
  profileHeadlineError,
} from "@/lib/profile-headline";
import {
  PROFILE_CUSTOMIZATION_BACKEND,
  saveProfileCustomization,
  type ProfileCustomization,
} from "@/lib/profile-customization";

type Props = {
  initial: ProfileCustomization;
  name: string;
  avatarUrl: string | null;
  publicPageHref: string | null;
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "pending_backend" }
  | { kind: "error"; message: string };

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => !/^(dr|prof)\.?$/i.test(w));
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Settings › "Your public page": the doctor picks one of our three colours and an
 * optional headline, with a live preview in light and dark (the page opens in light;
 * anyone can switch it to dark there).
 */
export function ProfilePageCustomization({ initial, name, avatarUrl, publicPageHref }: Props) {
  const [accent, setAccent] = React.useState<ProfileAccentId>(initial.accent);
  const [headline, setHeadline] = React.useState(initial.headline ?? "");
  const [previewScheme, setPreviewScheme] = React.useState<"light" | "dark">("light");
  const [save, setSave] = React.useState<SaveState>({ kind: "idle" });

  const headlineTooLong = profileHeadlineError(headline) === "too_long";
  const shownHeadline = normalizeProfileHeadline(headline);
  const dirty =
    accent !== initial.accent || (shownHeadline ?? null) !== (initial.headline ?? null);

  const onSave = async () => {
    setSave({ kind: "saving" });
    // EXPECTED TO FAIL until Livio builds PATCH /api/professional-profile-customization
    // (see lib/profile-customization.ts for the contract): the server answers 404 today.
    const result = await saveProfileCustomization({ accent, headline });
    if (!("reason" in result)) {
      setSave({ kind: "saved" });
      return;
    }
    if (result.reason === "backend_pending") {
      setSave({ kind: "pending_backend" });
      return;
    }
    setSave({
      kind: "error",
      message:
        result.reason === "invalid"
          ? `Keep the headline under ${PROFILE_HEADLINE_MAX_LENGTH} characters.`
          : "Could not save. Please try again.",
    });
  };

  return (
    <section
      aria-labelledby="public-page-heading"
      data-testid="settings-public-page"
      className="rounded-3xl border border-clinical-100/10 bg-slate-900/50 p-6 shadow-2xl shadow-ink-900/50 backdrop-blur-xl sm:p-8"
    >
      <h2 id="public-page-heading" className="text-xl font-semibold text-slate-50">
        Your public page
      </h2>
      <p className="mt-1 text-sm text-slate-300">
        Make it yours: pick a colour and add a line under your name. Every colour is
        tested to stay readable in light and dark mode.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-semibold text-slate-100">Page colour</legend>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {PROFILE_ACCENT_IDS.map((id) => {
                const palette = PROFILE_ACCENTS[id];
                const selected = id === accent;
                return (
                  <label
                    key={id}
                    title={palette.label}
                    className={`relative flex h-12 cursor-pointer items-center justify-center rounded-2xl border-[3px] transition focus-within:ring-2 focus-within:ring-white ${
                      selected ? "border-white" : "border-transparent hover:border-white/40"
                    }`}
                    style={{ backgroundColor: palette.hero, color: palette.onHero }}
                  >
                    <input
                      type="radio"
                      name="profile-accent"
                      value={id}
                      checked={selected}
                      onChange={() => {
                        setAccent(id);
                        setSave({ kind: "idle" });
                      }}
                      className="sr-only"
                      aria-label={palette.label}
                    />
                    {selected ? <Check className="h-5 w-5" strokeWidth={3} aria-hidden /> : null}
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-sm font-medium text-slate-300">
              {PROFILE_ACCENTS[accent].label}
              {accent === "teal" ? " (DocCy)" : ""}
            </p>
          </fieldset>

          <div>
            <label htmlFor="profile-headline" className="text-sm font-semibold text-slate-100">
              Headline <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <p className="mt-1 text-sm text-slate-400">One line under your name, in your own words.</p>
            <input
              id="profile-headline"
              type="text"
              value={headline}
              onChange={(e) => {
                setHeadline(e.target.value);
                setSave({ kind: "idle" });
              }}
              placeholder="e.g. Skin care for the whole family"
              aria-invalid={headlineTooLong}
              aria-describedby="profile-headline-count"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-clinical-400"
            />
            <p
              id="profile-headline-count"
              className={`mt-1 text-right text-xs ${headlineTooLong ? "font-semibold text-red-300" : "text-slate-400"}`}
            >
              {headline.replace(/\s+/g, " ").trim().length} / {PROFILE_HEADLINE_MAX_LENGTH}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || headlineTooLong || save.kind === "saving"}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-clinical-500 px-5 text-sm font-semibold text-white transition hover:bg-clinical-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {save.kind === "saving" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Save
            </button>
            {publicPageHref ? (
              <a
                href={publicPageHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-5 text-sm font-semibold text-slate-100 transition hover:border-clinical-400"
              >
                View my page
              </a>
            ) : null}
          </div>

          <div aria-live="polite">
            {save.kind === "saved" ? (
              <p className="text-sm font-medium text-emerald-300">Saved. Your page uses it now.</p>
            ) : null}
            {save.kind === "pending_backend" ? (
              <p
                data-testid="settings-public-page-pending"
                className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100"
              >
                Expected to fail for now: saving your page colour and headline works once
                Livio builds it in the backend ({PROFILE_CUSTOMIZATION_BACKEND.method}{" "}
                {PROFILE_CUSTOMIZATION_BACKEND.endpoint}).
              </p>
            ) : null}
            {save.kind === "error" ? (
              <p className="text-sm font-medium text-red-300">{save.message}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-100">Live preview</span>
            <div role="group" aria-label="Preview mode" className="flex gap-1 rounded-full bg-slate-800 p-1">
              {(["light", "dark"] as const).map((scheme) => (
                <button
                  key={scheme}
                  type="button"
                  aria-pressed={previewScheme === scheme}
                  onClick={() => setPreviewScheme(scheme)}
                  className={`min-h-9 rounded-full px-4 text-xs font-semibold capitalize transition ${
                    previewScheme === scheme ? "bg-white text-ink-900" : "text-slate-300 hover:text-white"
                  }`}
                >
                  {scheme}
                </button>
              ))}
            </div>
          </div>

          <div
            className="doccy-profile rounded-3xl border border-profile-border p-4"
            data-scheme={previewScheme}
            style={profileThemeStyle(accent)}
            aria-hidden
          >
            <div className="flex items-center gap-4 rounded-[1.5rem] bg-accent p-5 text-accent-on">
              <div className="relative flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-accent-avatar text-2xl font-extrabold">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initialsOf(name)
                )}
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-extrabold leading-tight tracking-tight">{name}</p>
                {shownHeadline ? (
                  <p className="mt-1 text-[15px] font-semibold leading-snug">{shownHeadline}</p>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex gap-2 text-sm font-bold">
              <span className="rounded-full bg-accent-cta px-3 py-1.5 text-accent-on-cta">Book</span>
              <span className="px-3 py-1.5 text-profile-text">About</span>
              <span className="px-3 py-1.5 text-profile-text">Services &amp; prices</span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {["09:30", "10:30", "11:00", "12:30"].map((time, i) => (
                <span
                  key={time}
                  className={`flex min-h-11 items-center justify-center rounded-xl border-2 font-bold ${
                    i === 0
                      ? "border-accent-cta bg-accent-cta text-accent-on-cta"
                      : "border-accent-soft bg-profile-surface text-profile-text"
                  }`}
                >
                  {time}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Your page opens in light. Anyone visiting can switch it to dark, and your colour
            looks right in both.
          </p>
        </div>
      </div>
    </section>
  );
}
