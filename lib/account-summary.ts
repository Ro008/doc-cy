import type { SupabaseClient } from "@supabase/supabase-js";

import {
  PROFESSIONAL_REGISTRATION_REQUEST_TYPE,
  REGISTRATION_UPLOADS_BUCKET,
} from "@/lib/professional-registration-request";
import { loadRegistrationStatus, type RegistrationStatus } from "@/lib/registration-status";

/**
 * What the top-right menu knows about a signed-in account (user, 2026-09-28):
 * - `professional`: a profile exists (full menu, their avatar);
 * - `applicant`: no profile yet, but an application is waiting, was decided, or a
 *   draft waits for the confirmation link (Support and Log out only, and the photo
 *   they uploaded, still in the private `request-uploads` bucket);
 * - `none`: no profile and no application (not kept signed in).
 */

export type AccountKind = "professional" | "applicant" | "none";

export type AccountSummary = {
  kind: AccountKind;
  /** An applicant's name from their application (a professional's comes from the profile). */
  name: string | null;
  /** A short-lived link to an applicant's uploaded photo. */
  photoUrl: string | null;
};

export function accountKind(input: { hasProfessional: boolean; status: RegistrationStatus["kind"] }): AccountKind {
  if (input.hasProfessional) return "professional";
  return input.status === "none" ? "none" : "applicant";
}

type DetailsLike = Record<string, unknown> | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nameOf(details: DetailsLike): string | null {
  if (!isRecord(details)) return null;
  const name = `${String(details.first_name ?? "").trim()} ${String(details.last_name ?? "").trim()}`.trim();
  return name || null;
}

/** undefined = the details don't say; null = no photo (founders removed it). */
function photoOf(details: DetailsLike, authUserId: string): string | null | undefined {
  if (!isRecord(details) || !("photo" in details)) return undefined;
  const photo = details.photo;
  if (!isRecord(photo)) return null;
  const path = String(photo.path ?? "").trim();
  // Only this login's own upload: never sign a path the details merely name.
  return path.startsWith(`${PROFESSIONAL_REGISTRATION_REQUEST_TYPE}/${authUserId}/`) ? path : null;
}

/**
 * The applicant's name and photo: the draft still waiting for the confirmation link
 * first, else the latest request (what founders approved or corrected, when they did).
 */
export function applicantIdentity(
  authUserId: string,
  input: {
    draft: DetailsLike;
    latestRequest: { details: DetailsLike; approved_details: DetailsLike } | null;
  },
): { name: string | null; photoPath: string | null } {
  const sources: DetailsLike[] = input.draft
    ? [input.draft]
    : input.latestRequest
      ? [input.latestRequest.approved_details, input.latestRequest.details]
      : [];
  let name: string | null = null;
  let photoPath: string | null | undefined;
  for (const details of sources) {
    if (!isRecord(details)) continue;
    name ??= nameOf(details);
    if (photoPath === undefined) photoPath = photoOf(details, authUserId);
  }
  return { name, photoPath: photoPath ?? null };
}

const PHOTO_URL_SECONDS = 60 * 60;

/** Service role only. */
export async function loadAccountSummary(service: SupabaseClient, authUserId: string): Promise<AccountSummary> {
  const { data: professional, error } = await service
    .from("professionals")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(`account summary: ${error.message}`);
  if (professional?.id) return { kind: "professional", name: null, photoUrl: null };

  const status = await loadRegistrationStatus(service, authUserId);
  const kind = accountKind({ hasProfessional: false, status: status.kind });
  if (kind === "none") return { kind, name: null, photoUrl: null };

  const [draft, latest] = await Promise.all([
    service
      .from("request_drafts")
      .select("details")
      .eq("auth_user_id", authUserId)
      .eq("request_type", PROFESSIONAL_REGISTRATION_REQUEST_TYPE)
      .maybeSingle(),
    service
      .from("request_log")
      .select("details, approved_details")
      .eq("applicant_auth_user_id", authUserId)
      .eq("request_type", PROFESSIONAL_REGISTRATION_REQUEST_TYPE)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const identity = applicantIdentity(authUserId, {
    draft: (draft.data?.details as DetailsLike) ?? null,
    latestRequest: latest.data
      ? { details: latest.data.details as DetailsLike, approved_details: latest.data.approved_details as DetailsLike }
      : null,
  });

  let photoUrl: string | null = null;
  if (identity.photoPath) {
    const { data: signed } = await service.storage
      .from(REGISTRATION_UPLOADS_BUCKET)
      .createSignedUrl(identity.photoPath, PHOTO_URL_SECONDS);
    photoUrl = signed?.signedUrl ?? null;
  }
  return { kind, name: identity.name, photoUrl };
}
