import { buildDoctorSlugCandidates } from "@/lib/doctor-slug";

/**
 * The professional's name and photo change by request (user, 2026-10-10). Both need
 * a founder: a request_log row born "pending", one open request per kind, withdrawn
 * by her while it is open (migration *_professional_profile_change_requests).
 * This file is the part with no database in it (the Settings page imports it too):
 * what Settings shows, the public address for a new name and the wording of
 * refusals. The emails are in lib/profile-change-emails.ts.
 */

export const NAME_CHANGE_REQUEST_TYPE = "professional_name_change";
export const PHOTO_CHANGE_REQUEST_TYPE = "professional_photo_change";
export const PROFILE_CHANGE_REQUEST_TYPES = [NAME_CHANGE_REQUEST_TYPE, PHOTO_CHANGE_REQUEST_TYPE] as const;

export type ProfileChangeRequestType = (typeof PROFILE_CHANGE_REQUEST_TYPES)[number];
export type ProfileChangeKind = "name" | "photo";

export const profileChangeKind = (type: string): ProfileChangeKind =>
  type === PHOTO_CHANGE_REQUEST_TYPE ? "photo" : "name";

export const NAME_CHANGE_MAX_LENGTH = 80;

export type ProfileChangeRow = {
  id: string;
  request_type: string;
  status: string;
  details: unknown;
  created_at: string;
  decided_at: string | null;
  decision_note: string | null;
};

export type PendingProfileChange = {
  id: string;
  createdAt: string;
  /** Name requests: the name she asked for. */
  name: string | null;
  /** Photo requests: where the new photo waits (private bucket). */
  photoPath: string | null;
};

export type DeniedProfileChange = { id: string; decidedAt: string; reason: string; name: string | null };

export type ProfileChangeState = { pending: PendingProfileChange | null; denied: DeniedProfileChange | null };

const detail = (details: unknown, key: string): string | null => {
  const value = (details as Record<string, unknown> | null)?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

/**
 * What Settings shows for one kind: her open request, or the reason when her latest
 * request was denied (until she sends another one, or dismisses it on the page).
 */
export function profileChangeState(rows: ProfileChangeRow[], type: ProfileChangeRequestType): ProfileChangeState {
  const latest = rows
    .filter((row) => row.request_type === type)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!latest) return { pending: null, denied: null };
  if (latest.status === "pending") {
    return {
      pending: {
        id: latest.id,
        createdAt: latest.created_at,
        name: detail(latest.details, "name"),
        photoPath: detail(latest.details, "photo_path"),
      },
      denied: null,
    };
  }
  if (latest.status === "rejected") {
    return {
      pending: null,
      denied: {
        id: latest.id,
        decidedAt: latest.decided_at ?? latest.created_at,
        reason: latest.decision_note ?? "",
        name: detail(latest.details, "name"),
      },
    };
  }
  return { pending: null, denied: null };
}

/** "10/10/2026", in Cyprus time. */
export function profileChangeRequestDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Nicosia",
  }).format(date);
}

/**
 * The public address for the approved name: hers when it still fits the name,
 * otherwise the first free one (name, name-district, name-2…). `taken` holds, in
 * lower case, other profiles' addresses and addresses that still forward to them.
 */
export function pickNameChangeSlug(input: {
  name: string;
  currentSlug: string | null;
  district: string | null;
  authUserId: string;
  taken: ReadonlySet<string>;
}): string {
  const candidates = nameChangeSlugCandidates(input);
  const current = String(input.currentSlug ?? "").trim().toLowerCase();
  if (current && candidates.some((candidate) => candidate.toLowerCase() === current)) return current;
  const free = candidates.find((candidate) => !input.taken.has(candidate.toLowerCase()));
  return (free ?? candidates[candidates.length - 1]!).toLowerCase();
}

export function nameChangeSlugCandidates(input: {
  name: string;
  district: string | null;
  authUserId: string;
}): string[] {
  return buildDoctorSlugCandidates({ name: input.name, district: input.district, authUserId: input.authUserId });
}

/** The private bucket's own limit (request-uploads): 1 MB, JPEG / PNG / WebP. */
export const PHOTO_CHANGE_MAX_BYTES = 1024 * 1024;

const PHOTO_EXTENSIONS: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** The new photo as it arrives from Settings (cropped there to a 900 px JPEG). */
export function photoChangeUploadCheck(file: {
  type: string;
  size: number;
}): { ok: true; extension: "jpg" | "png" | "webp" } | { ok: false; message: string } {
  const extension = PHOTO_EXTENSIONS[file.type.toLowerCase()];
  if (!extension) return { ok: false, message: "Use a JPEG, PNG or WebP image." };
  if (file.size <= 0 || file.size > PHOTO_CHANGE_MAX_BYTES) {
    return { ok: false, message: "The photo must be under 1 MB." };
  }
  return { ok: true, extension };
}

/** Where a requested photo waits for the founders, in the private request-uploads bucket. */
export function photoChangeUploadPath(professionalId: string, stamp: string, extension: string): string {
  return `${PHOTO_CHANGE_REQUEST_TYPE}/${professionalId}/${stamp}.${extension}`;
}

export type ReviewedNameChange =
  | { ok: true; name: string; corrected: { name: string; reason: string | null } | null }
  | { ok: false; message: string };

/**
 * The name a founder approves: hers, or their correction of it (a typo, capitals).
 * `corrected` is what request_approve records as approved_details, null when unchanged.
 */
export function reviewedNameChange(
  details: { name: string; reason: string | null },
  founderName: unknown,
): ReviewedNameChange {
  if (founderName === undefined || founderName === null) return { ok: true, name: details.name, corrected: null };
  const name = String(founderName).trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, message: "Enter the name to approve." };
  if (name.length > NAME_CHANGE_MAX_LENGTH) {
    return { ok: false, message: `Keep the name under ${NAME_CHANGE_MAX_LENGTH} characters.` };
  }
  if (name === details.name) return { ok: true, name, corrected: null };
  return { ok: true, name, corrected: { name, reason: details.reason } };
}

/** A database refusal in plain words, for her ("submit", "withdraw") or the founder ("decide"). */
export function profileChangeDbErrorMessage(
  error: { code?: string | null; message?: string | null },
  action: "submit" | "withdraw" | "decide",
): { status: number; message: string } {
  const code = error.code ?? "";
  const text = error.message ?? "";
  if (action === "submit") {
    if (code === "23505") {
      return { status: 409, message: "You already have a request waiting. Withdraw it to send a new one." };
    }
    if (code === "22023") return { status: 400, message: "That request could not be sent. Check it and try again." };
    return { status: 500, message: "Could not send the request. Please try again." };
  }
  if (action === "withdraw") {
    if (code === "55000") {
      return { status: 409, message: "DocCy has already decided this request. Reload the page to see the result." };
    }
    return { status: 500, message: "Could not withdraw the request. Please try again." };
  }
  if (code === "42501") return { status: 403, message: "Only founders can decide requests." };
  if (code === "P0002") return { status: 404, message: "That request or its professional no longer exists." };
  if (code === "23505") return { status: 409, message: "That profile address was just taken. Try approving again." };
  if (code === "55000") {
    return /name changed since/.test(text)
      ? { status: 409, message: "The name changed since this request was made. Deny it and ask for a new request." }
      : { status: 409, message: "This request was already decided or withdrawn. Reload the page." };
  }
  if (code === "22023") return { status: 400, message: text || "That decision could not be saved." };
  return { status: 500, message: "Could not save the decision. Please try again." };
}
