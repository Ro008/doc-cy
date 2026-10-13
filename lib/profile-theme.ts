/**
 * Public profile colours: the page surfaces (light by default; anyone can switch to
 * dark on the page) and DocCy's teal accent, the same on every profile (user,
 * 2026-10-13: the professional picks no colour).
 *
 * Every pair is checked for WCAG AA contrast in tests/unit/profile-theme.test.ts.
 * globals.css (.doccy-profile, data-scheme) switches the variables between light and dark.
 */

export type ProfileAccentPalette = {
  /** Hero card, chips, selected clinic: same in light and dark. */
  hero: string;
  /** Text on `hero`, `heroBtn` and `avatar`. */
  onHero: string;
  /** Secondary buttons inside the hero. */
  heroBtn: string;
  /** Initials tile when there is no photo. */
  avatar: string;
  /** Primary CTA and selected day/time in light mode (white text). */
  ink: string;
  /** Tinted panels and free days, light / dark. */
  soft: string;
  softDark: string;
  /** Text links, light / dark. */
  link: string;
  linkDark: string;
};

export const PROFILE_ACCENT: ProfileAccentPalette = {
  hero: "#12B8C0",
  onHero: "#062F61",
  heroBtn: "#A6EDF0",
  avatar: "#8FE3E7",
  ink: "#062F61",
  soft: "#DDF6F8",
  softDark: "#08436F",
  link: "#0A6B72",
  linkDark: "#7FE6EB",
};

export type ProfileSurfaces = {
  bg: string;
  surface: string;
  border: string;
  text: string;
  body: string;
  muted: string;
  /** Disabled days and placeholders only; never essential text. */
  off: string;
};

export const PROFILE_SURFACES: { light: ProfileSurfaces; dark: ProfileSurfaces } = {
  light: {
    bg: "#F6FAFB",
    surface: "#FFFFFF",
    border: "#DCE9EC",
    text: "#0B2236",
    body: "#24364B",
    muted: "#4A5F73",
    off: "#A9B8C6",
  },
  // DocCy's navy, as on the professional's dashboard (user, 2026-10-10): ink-900 page,
  // slate-900/70 cards and slate-700/70 borders flattened over it, slate text.
  dark: {
    bg: "#062F61",
    surface: "#0C1E3B",
    border: "#263C59",
    text: "#F8FAFC",
    body: "#E2E8F0",
    muted: "#94A3B8",
    off: "#4B5D78",
  },
};

/** CSS variables for the page root; globals.css picks the light or dark tone. */
export function profileThemeStyle(): Record<`--${string}`, string> {
  const p = PROFILE_ACCENT;
  const surfaces: Record<`--${string}`, string> = {};
  for (const mode of ["light", "dark"] as const) {
    for (const [key, value] of Object.entries(PROFILE_SURFACES[mode])) {
      surfaces[`--p-${key}-${mode}`] = value;
    }
  }
  return {
    ...surfaces,
    "--p-accent": p.hero,
    "--p-accent-on": p.onHero,
    "--p-accent-btn": p.heroBtn,
    "--p-accent-avatar": p.avatar,
    "--p-accent-ink": p.ink,
    "--p-accent-soft-light": p.soft,
    "--p-accent-soft-dark": p.softDark,
    "--p-accent-link-light": p.link,
    "--p-accent-link-dark": p.linkDark,
  };
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2 contrast ratio between two `#RRGGBB` colours (1–21). */
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
