import {
  DEFAULT_PROFILE_ACCENT,
  resolveProfileAccent,
  type ProfileAccentId,
} from "@/lib/profile-theme";
import { normalizeProfileHeadline, profileHeadlineError } from "@/lib/profile-headline";

/**
 * What a professional customises on their public page: the accent colour (teal, amber
 * or violet) and an optional headline under their name. Light/dark is the visitor's
 * choice on the page (lib/profile-scheme.ts), not the professional's.
 *
 * BACKEND PENDING (Livio) — contract the frontend already uses:
 * - Columns `professionals.profile_accent text` (one of PROFILE_ACCENT_IDS, default
 *   'teal') and `professionals.profile_headline text` (≤ 90 chars, nullable), added to
 *   the public profile field list so `profileCustomizationFromRow` sees them.
 * - `PATCH /api/professional-profile-customization`, signed-in professional only,
 *   body `{ accent: ProfileAccentId, headline: string | null }`, validates with
 *   resolveProfileAccent / profileHeadlineError, writes those two columns of the
 *   caller's own row, answers 200 `{ ok: true }`; 400 on invalid input; 401 signed out.
 * Until then the page shows teal + no headline, and saving reports `backend_pending`.
 */

export type ProfileCustomization = {
  accent: ProfileAccentId;
  headline: string | null;
};

export const DEFAULT_PROFILE_CUSTOMIZATION: ProfileCustomization = {
  accent: DEFAULT_PROFILE_ACCENT,
  headline: null,
};

export const PROFILE_CUSTOMIZATION_BACKEND = {
  method: "PATCH",
  endpoint: "/api/professional-profile-customization",
  columns: ["professionals.profile_accent", "professionals.profile_headline"],
} as const;

export function profileCustomizationFromRow(row: unknown): ProfileCustomization {
  if (!row || typeof row !== "object") return { ...DEFAULT_PROFILE_CUSTOMIZATION };
  const source = row as { profile_accent?: unknown; profile_headline?: unknown };
  return {
    accent: resolveProfileAccent(source.profile_accent),
    headline: normalizeProfileHeadline(source.profile_headline),
  };
}

export type SaveProfileCustomizationResult =
  | { ok: true }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "backend_pending"; status: number }
  | { ok: false; reason: "failed"; status?: number };

export async function saveProfileCustomization(
  input: { accent: ProfileAccentId; headline: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<SaveProfileCustomizationResult> {
  if (profileHeadlineError(input.headline ?? "")) return { ok: false, reason: "invalid" };

  const body = {
    accent: resolveProfileAccent(input.accent),
    headline: normalizeProfileHeadline(input.headline),
  };

  try {
    // EXPECTED TO FAIL until Livio builds PATCH /api/professional-profile-customization (404).
    const res = await fetchImpl(PROFILE_CUSTOMIZATION_BACKEND.endpoint, {
      method: PROFILE_CUSTOMIZATION_BACKEND.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    if (res.status === 404 || res.status === 405) {
      return { ok: false, reason: "backend_pending", status: res.status };
    }
    return { ok: false, reason: "failed", status: res.status };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
