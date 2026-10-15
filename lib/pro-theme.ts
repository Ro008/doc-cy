/**
 * The professional's own pages (Dashboard, Agenda, Visits, Settings, Help) share the public
 * profile's dark palette (user, 2026-10-15): a deep navy page with slightly lighter cards in
 * front of it. Tailwind exposes these as `pro-page`, `pro-card`, `pro-raised` and `pro-line`.
 *
 * Contrast is checked in tests/unit/pro-theme.test.ts.
 */

import { PROFILE_SURFACES } from "./profile-theme";

export const PRO_SURFACES = {
  /** Page background, top bar and bottom tab bar; also input wells (with opacity). */
  page: PROFILE_SURFACES.dark.bg,
  /** Cards, dialogs and menus. */
  card: PROFILE_SURFACES.dark.surface,
  /** Rows and chips inside a card. */
  raised: "#1A3260",
  /** Card and field borders. */
  line: PROFILE_SURFACES.dark.border,
} as const;
