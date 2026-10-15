import { normalizeProfileHeadline, profileHeadlineError } from "@/lib/profile-headline";

/**
 * What a professional customises on their public page: an optional headline under
 * their name. The colour is DocCy's teal on every profile (user, 2026-10-13), and
 * light/dark is the visitor's choice (lib/profile-scheme.ts), not the professional's.
 *
 * - Column `professionals.profile_headline` (≤ 90 chars, nullable), read with
 *   `loadProfileHeadline` (lib/profile-headline-server.ts).
 * - `PATCH /api/professional-profile-customization`, signed-in professional only, body
 *   `{ headline: string | null }`: 200 `{ ok: true }`; 400 invalid; 401 signed out;
 *   429 changed too often (5 in a rolling 30 days; the message says when it opens again).
 *   Every change is recorded in request_log, with no founder.
 */

export type ProfileCustomization = {
  headline: string | null;
};

export const DEFAULT_PROFILE_CUSTOMIZATION: ProfileCustomization = {
  headline: null,
};

export const PROFILE_CUSTOMIZATION_BACKEND = {
  method: "PATCH",
  endpoint: "/api/professional-profile-customization",
  columns: ["professionals.profile_headline"],
} as const;

export function profileCustomizationFromRow(row: unknown): ProfileCustomization {
  if (!row || typeof row !== "object") return { ...DEFAULT_PROFILE_CUSTOMIZATION };
  const source = row as { profile_headline?: unknown };
  return { headline: normalizeProfileHeadline(source.profile_headline) };
}

export type SaveProfileCustomizationResult =
  | { ok: true }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "too_often"; message: string }
  | { ok: false; reason: "failed"; status?: number };

export async function saveProfileCustomization(
  input: { headline: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<SaveProfileCustomizationResult> {
  if (profileHeadlineError(input.headline ?? "")) return { ok: false, reason: "invalid" };

  const body = { headline: normalizeProfileHeadline(input.headline) };

  try {
    const res = await fetchImpl(PROFILE_CUSTOMIZATION_BACKEND.endpoint, {
      method: PROFILE_CUSTOMIZATION_BACKEND.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    if (res.status === 429) {
      // Changed too often: the server says when she can change it again.
      const data = (await res.json().catch(() => null)) as { message?: unknown } | null;
      const message =
        typeof data?.message === "string" && data.message.trim()
          ? data.message.trim()
          : "You have reached the limit for this change. Please try again later.";
      return { ok: false, reason: "too_often", message };
    }
    return { ok: false, reason: "failed", status: res.status };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
