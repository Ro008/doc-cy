/**
 * Public profile colours: the page surfaces (light by default; anyone can switch to
 * dark on the page) and the three accents a professional can choose for their page.
 *
 * Every palette is checked for WCAG AA contrast in tests/unit/profile-theme.test.ts,
 * so a professional can never pick a combination patients cannot read.
 * globals.css (.doccy-profile, data-scheme) switches the variables between light and dark.
 */

export const PROFILE_ACCENT_IDS = ["teal", "amber", "violet"] as const;
export type ProfileAccentId = (typeof PROFILE_ACCENT_IDS)[number];
export const DEFAULT_PROFILE_ACCENT: ProfileAccentId = "teal";

export type ProfileAccentPalette = {
  label: string;
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

export const PROFILE_ACCENTS: Record<ProfileAccentId, ProfileAccentPalette> = {
  teal: {
    label: "Teal",
    hero: "#12B8C0",
    onHero: "#062F61",
    heroBtn: "#A6EDF0",
    avatar: "#8FE3E7",
    ink: "#062F61",
    soft: "#DDF6F8",
    softDark: "#123540",
    link: "#0A6B72",
    linkDark: "#7FE6EB",
  },
  violet: {
    label: "Violet",
    hero: "#9B87FF",
    onHero: "#1A0F4D",
    heroBtn: "#D3CAFF",
    avatar: "#BDB0FF",
    ink: "#2A1A7A",
    soft: "#ECE8FF",
    softDark: "#262060",
    link: "#4A2BE0",
    linkDark: "#C7BCFF",
  },
  amber: {
    label: "Amber",
    hero: "#FFC233",
    onHero: "#2B1E00",
    heroBtn: "#FFE39A",
    avatar: "#FFD66E",
    ink: "#3D2B00",
    soft: "#FFF4D1",
    softDark: "#3A2E0B",
    link: "#8A5A00",
    linkDark: "#FFD66E",
  },
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
  dark: {
    bg: "#0B1418",
    surface: "#13232A",
    border: "#24404A",
    text: "#F2FBFC",
    body: "#D4E6EA",
    muted: "#9AB5BD",
    off: "#4F6B74",
  },
};

export function resolveProfileAccent(raw: unknown): ProfileAccentId {
  if (typeof raw !== "string") return DEFAULT_PROFILE_ACCENT;
  const id = raw.trim().toLowerCase();
  return (PROFILE_ACCENT_IDS as readonly string[]).includes(id)
    ? (id as ProfileAccentId)
    : DEFAULT_PROFILE_ACCENT;
}

/** CSS variables for the page root; globals.css picks the light or dark tone. */
export function profileThemeStyle(accent: ProfileAccentId): Record<`--${string}`, string> {
  const p = PROFILE_ACCENTS[resolveProfileAccent(accent)];
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
