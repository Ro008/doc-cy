/**
 * Public site colours (Finder, Clinics and their components) in light and dark.
 *
 * Each colour replaces one Tailwind shade the Finder used, per property: `bg-white` became
 * `bg-site-white`, `text-ink-900` became `text-site-ink-900`. Light is that shade, so light
 * mode looks exactly as before; dark is the public profile's palette (lib/profile-theme.ts:
 * deep navy page, lighter cards, pale teal links).
 *
 * Tailwind reads `var(--site-…, <light>)`; globals.css sets the dark values on
 * `.doccy-profile[data-scheme="dark"]`. Both are checked in tests/unit/site-theme.test.ts,
 * dark text for WCAG AA on every dark surface.
 *
 * Shades with an opacity (`bg-white/10`) and the teal buttons stay as they are: they sit on
 * coloured panels that look the same in both modes.
 */

export type SiteColour = { light: string; dark: string };

export const SITE_COLOURS = {
  background: {
    white: { light: "#FFFFFF", dark: "#11264A" },
    "ink-50": { light: "#F7FAFC", dark: "#08142A" },
    "ink-100": { light: "#EEF4F8", dark: "#1A3260" },
    "clinical-50": { light: "#F0FBFC", dark: "#14365E" },
    "clinical-100": { light: "#E6F8F9", dark: "#0E3D66" },
  },
  text: {
    "ink-900": { light: "#062F61", dark: "#F8FAFC" },
    "ink-800": { light: "#24364B", dark: "#E2E8F0" },
    "ink-700": { light: "#33485C", dark: "#CBD5E1" },
    "ink-600": { light: "#4A5F73", dark: "#B4C1D1" },
    "ink-500": { light: "#718096", dark: "#A3B1C2" },
    "ink-400": { light: "#8A9BB0", dark: "#8395AD" },
    "clinical-900": { light: "#074D52", dark: "#A6EDF0" },
    "clinical-800": { light: "#0A6B72", dark: "#7FE6EB" },
    "clinical-700": { light: "#0D8A94", dark: "#7FE6EB" },
    "clinical-600": { light: "#0FA7B4", dark: "#6EDDE3" },
    "clinical-500": { light: "#12B8C0", dark: "#3FCBD2" },
    "slate-900": { light: "#0F172A", dark: "#F8FAFC" },
    "slate-600": { light: "#475569", dark: "#B4C1D1" },
    "slate-500": { light: "#64748B", dark: "#A3B1C2" },
  },
  border: {
    "ink-100": { light: "#EEF4F8", dark: "#1B3052" },
    "ink-200": { light: "#DDE7ED", dark: "#22385A" },
    "clinical-200": { light: "#B8EBEF", dark: "#22385A" },
    "clinical-300": { light: "#7DD9DF", dark: "#2F5078" },
    "clinical-400": { light: "#3AC5CD", dark: "#3F6C94" },
  },
  ringOffset: {
    "ink-50": { light: "#F7FAFC", dark: "#08142A" },
  },
} satisfies Record<string, Record<string, SiteColour>>;

export type SiteColourGroup = keyof typeof SITE_COLOURS;

const VAR_PREFIX: Record<SiteColourGroup, string> = {
  background: "bg",
  text: "text",
  border: "border",
  ringOffset: "ring-offset",
};

/** `--site-text-ink-900` and friends. */
export function siteColourVar(group: SiteColourGroup, key: string): `--${string}` {
  return `--site-${VAR_PREFIX[group]}-${key}`;
}

/** The Tailwind colours for one property: `{ "ink-900": "var(--site-text-ink-900, #062F61)" }`. */
export function tailwindSiteColours(group: SiteColourGroup): Record<string, string> {
  return Object.fromEntries(
    Object.entries(SITE_COLOURS[group]).map(([key, { light }]) => [
      key,
      `var(${siteColourVar(group, key)}, ${light})`,
    ]),
  );
}

/** The dark-mode declarations for globals.css (kept in step by the unit test). */
export function siteDarkDeclarations(): string {
  return (Object.keys(SITE_COLOURS) as SiteColourGroup[])
    .flatMap((group) =>
      Object.entries(SITE_COLOURS[group]).map(
        ([key, { dark }]) => `  ${siteColourVar(group, key)}: ${dark};`,
      ),
    )
    .join("\n");
}
