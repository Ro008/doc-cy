import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildProfileChangeApprovedEmail,
  buildProfileChangeDeniedEmail,
  buildProfileChangeNotifyContent,
} from "@/lib/profile-change-emails";
import {
  NAME_CHANGE_REQUEST_TYPE,
  PHOTO_CHANGE_REQUEST_TYPE,
  PROFILE_CHANGE_REQUEST_TYPES,
  nameChangeSlugCandidates,
  photoChangeUploadCheck,
  photoChangeUploadPath,
  pickNameChangeSlug,
  profileChangeDbErrorMessage,
  profileChangeKind,
  profileChangeState,
  reviewedNameChange,
  type ProfileChangeKind,
  type ProfileChangeRequestType,
  type ProfileChangeRow,
  type ProfileChangeState,
} from "@/lib/profile-change-requests";
import { REGISTRATION_UPLOADS_BUCKET } from "@/lib/professional-registration-request";
import { approvedAvatarPath } from "@/lib/registration-approval";
import { sendRegistrationDecisionEmail } from "@/lib/registration-decision-emails";
import { registrationNotifyRecipients, type FounderRecipientRow } from "@/lib/registration-request-notify";
import { sendResendEmail } from "@/lib/resend";
import { validateNameChangeRequest } from "@/lib/settings-profile-details";
import { getPublicBookingBaseUrl } from "@/lib/site-url";

/**
 * Server side of the name and photo change requests: she sends and withdraws them
 * from Settings; founders approve or deny them on the dashboard's Requests tab.
 * Service role only; callers check the session (or the admin) first.
 */

export type HttpResult<T> = ({ ok: true } & T) | { ok: false; status: number; message: string };

const REASON_MAX_LENGTH = 200;
const RECENT_DECISIONS = 15;

const PHOTO_URL_SECONDS = 60 * 60;

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

/** A requested photo waits in the private bucket: it is shown through a short-lived link. */
async function signedPhotoUrl(service: SupabaseClient, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await service.storage.from(REGISTRATION_UPLOADS_BUCKET).createSignedUrl(path, PHOTO_URL_SECONDS);
  return data?.signedUrl ?? null;
}

const publicAvatarUrl = (service: SupabaseClient, path: string | null | undefined): string | null =>
  path && path.trim() ? service.storage.from("avatars").getPublicUrl(path.trim()).data.publicUrl : null;

export type ProfileChangeStates = {
  name: ProfileChangeState;
  photo: ProfileChangeState;
  /** The photo she asked for, when a photo request is open. */
  pendingPhotoUrl: string | null;
};

/** What Settings shows for each kind (her open request, or her latest denial). */
export async function loadProfileChangeStates(
  service: SupabaseClient,
  professionalId: string,
): Promise<ProfileChangeStates> {
  const { data, error } = await service
    .from("request_log")
    .select("id, request_type, status, details, created_at, decided_at, decision_note")
    .eq("professional_id", professionalId)
    .in("request_type", [...PROFILE_CHANGE_REQUEST_TYPES])
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(`profile change requests: ${error.message}`);
  const rows = (data ?? []) as ProfileChangeRow[];
  const photo = profileChangeState(rows, PHOTO_CHANGE_REQUEST_TYPE);
  return {
    name: profileChangeState(rows, NAME_CHANGE_REQUEST_TYPE),
    photo,
    pendingPhotoUrl: await signedPhotoUrl(service, photo.pending?.photoPath),
  };
}

async function notifyFounders(
  service: SupabaseClient,
  input: { requesterEmail: string; subject: string; text: string; requestId: string; category: string },
): Promise<void> {
  try {
    const { data: founders } = await service
      .from("admin_users")
      .select("email, role, is_active")
      .eq("role", "founder")
      .eq("is_active", true);
    const recipients = registrationNotifyRecipients({
      applicantEmail: input.requesterEmail,
      founders: (founders ?? []) as FounderRecipientRow[],
      founderNotifyEmail: process.env.FOUNDER_NOTIFY_EMAIL,
    });
    if (recipients.length === 0) return;
    await sendResendEmail({
      to: recipients.length === 1 ? recipients[0]! : recipients,
      subject: input.subject,
      text: input.text,
      tags: [
        { name: "category", value: input.category },
        { name: "request_id", value: input.requestId.slice(0, 40) },
      ],
    });
  } catch (error) {
    console.error("[DocCy] profile change notify failed", error);
  }
}

/** She asks for a new name. One open request at a time; founders are told. */
export async function submitNameChangeRequest(
  service: SupabaseClient,
  input: { professionalId: string; name: unknown; reason: unknown },
): Promise<HttpResult<{ request: { id: string; name: string; createdAt: string } }>> {
  const { data: pro, error: proError } = await service
    .from("professionals")
    .select("id, name, registration_email, email")
    .eq("id", input.professionalId)
    .maybeSingle();
  if (proError || !pro) return { ok: false, status: 404, message: "Your profile was not found." };

  const check = validateNameChangeRequest(String(pro.name ?? ""), typeof input.name === "string" ? input.name : "");
  if (check.ok === false) return { ok: false, status: 400, message: check.message };
  const reason = typeof input.reason === "string" ? input.reason.trim().replace(/\s+/g, " ") : "";
  if (reason.length > REASON_MAX_LENGTH) {
    return { ok: false, status: 400, message: `Keep the reason under ${REASON_MAX_LENGTH} characters.` };
  }

  const { data: requestId, error } = await service.rpc("request_submit", {
    p_request_type: NAME_CHANGE_REQUEST_TYPE,
    p_professional_id: input.professionalId,
    p_details: { name: check.name, reason: reason || null },
  });
  if (error || !requestId) {
    if (error?.code !== "23505") console.error("[DocCy] name change request", error);
    return { ok: false, ...profileChangeDbErrorMessage(error ?? {}, "submit") };
  }

  const { data: saved } = await service.from("request_log").select("created_at").eq("id", requestId).maybeSingle();
  const content = buildProfileChangeNotifyContent({
    kind: "name",
    professionalName: String(pro.name ?? ""),
    requestedName: check.name,
    reason: reason || null,
    siteUrl: getPublicBookingBaseUrl(),
  });
  await notifyFounders(service, {
    requesterEmail: String(pro.registration_email ?? pro.email ?? ""),
    subject: content.subject,
    text: content.text,
    requestId: String(requestId),
    category: "founder-name-change-request",
  });
  return {
    ok: true,
    request: {
      id: String(requestId),
      name: check.name,
      createdAt: String(saved?.created_at ?? new Date().toISOString()),
    },
  };
}

/**
 * She asks for a new photo: it waits in the private bucket until a founder decides.
 * One open request at a time; founders are told.
 */
export async function submitPhotoChangeRequest(
  service: SupabaseClient,
  input: { professionalId: string; file: File },
): Promise<HttpResult<{ request: { id: string; createdAt: string; photoUrl: string | null } }>> {
  const check = photoChangeUploadCheck({ type: input.file.type, size: input.file.size });
  if (check.ok === false) return { ok: false, status: 400, message: check.message };

  const { data: pro, error: proError } = await service
    .from("professionals")
    .select("id, name, registration_email, email")
    .eq("id", input.professionalId)
    .maybeSingle();
  if (proError || !pro) return { ok: false, status: 404, message: "Your profile was not found." };

  // Before storing anything: a second request would leave its file behind.
  const { data: open } = await service
    .from("request_log")
    .select("id")
    .eq("professional_id", input.professionalId)
    .eq("request_type", PHOTO_CHANGE_REQUEST_TYPE)
    .eq("status", "pending")
    .maybeSingle();
  if (open) return { ok: false, ...profileChangeDbErrorMessage({ code: "23505" }, "submit") };

  const path = photoChangeUploadPath(
    input.professionalId,
    `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    check.extension,
  );
  const upload = await service.storage
    .from(REGISTRATION_UPLOADS_BUCKET)
    .upload(path, input.file, { contentType: input.file.type.toLowerCase(), upsert: false });
  if (upload.error) {
    console.error("[DocCy] photo change upload", upload.error);
    return { ok: false, status: 500, message: "Could not store the photo. Please try again." };
  }

  const { data: requestId, error } = await service.rpc("request_submit", {
    p_request_type: PHOTO_CHANGE_REQUEST_TYPE,
    p_professional_id: input.professionalId,
    p_details: { photo_path: path },
  });
  if (error || !requestId) {
    await service.storage.from(REGISTRATION_UPLOADS_BUCKET).remove([path]);
    if (error?.code !== "23505") console.error("[DocCy] photo change request", error);
    return { ok: false, ...profileChangeDbErrorMessage(error ?? {}, "submit") };
  }

  const { data: saved } = await service.from("request_log").select("created_at").eq("id", requestId).maybeSingle();
  const content = buildProfileChangeNotifyContent({
    kind: "photo",
    professionalName: String(pro.name ?? ""),
    siteUrl: getPublicBookingBaseUrl(),
  });
  await notifyFounders(service, {
    requesterEmail: String(pro.registration_email ?? pro.email ?? ""),
    subject: content.subject,
    text: content.text,
    requestId: String(requestId),
    category: "founder-photo-change-request",
  });
  return {
    ok: true,
    request: {
      id: String(requestId),
      createdAt: String(saved?.created_at ?? new Date().toISOString()),
      photoUrl: await signedPhotoUrl(service, path),
    },
  };
}

/**
 * She removes her photo: no founder, recorded at once (professional_photo_remove).
 * The file leaves the public bucket too.
 */
export async function removeProfessionalPhoto(
  service: SupabaseClient,
  professionalId: string,
): Promise<HttpResult<{ removed: boolean }>> {
  const { data: pro } = await service.from("professionals").select("avatar_url").eq("id", professionalId).maybeSingle();
  const path = text(pro?.avatar_url);
  const { data: requestId, error } = await service.rpc("professional_photo_remove", {
    p_professional_id: professionalId,
  });
  if (error) {
    console.error("[DocCy] photo remove", error);
    return { ok: false, status: 500, message: "Could not remove the photo. Please try again." };
  }
  if (requestId && path) {
    const removed = await service.storage.from("avatars").remove([path]);
    if (removed.error) console.error("[DocCy] photo remove: file stays", removed.error);
  }
  return { ok: true, removed: Boolean(requestId) };
}

/** She withdraws her open request of one kind, before a founder decides it. */
export async function withdrawProfileChangeRequest(
  service: SupabaseClient,
  input: { professionalId: string; type: ProfileChangeRequestType },
): Promise<HttpResult<{ requestId: string }>> {
  const { data: pending, error: lookupError } = await service
    .from("request_log")
    .select("id, details")
    .eq("professional_id", input.professionalId)
    .eq("request_type", input.type)
    .eq("status", "pending")
    .maybeSingle();
  if (lookupError) {
    console.error("[DocCy] profile change withdraw lookup", lookupError);
    return { ok: false, status: 500, message: "Could not withdraw the request. Please try again." };
  }
  // Nothing open: a founder decided it meanwhile (or it was already withdrawn).
  if (!pending) return { ok: false, ...profileChangeDbErrorMessage({ code: "55000" }, "withdraw") };

  const { error } = await service.rpc("request_withdraw", {
    p_request_id: pending.id,
    p_professional_id: input.professionalId,
  });
  if (error) {
    if (error.code !== "55000") console.error("[DocCy] profile change withdraw", error);
    return { ok: false, ...profileChangeDbErrorMessage(error, "withdraw") };
  }
  // Her withdrawn photo is not kept.
  const photoPath = text((pending.details as Record<string, unknown> | null)?.photo_path);
  if (input.type === PHOTO_CHANGE_REQUEST_TYPE && photoPath) {
    await service.storage.from(REGISTRATION_UPLOADS_BUCKET).remove([photoPath]);
  }
  return { ok: true, requestId: String(pending.id) };
}

// ------------------------------------------------------------------ founders

export type ProfileChangeReviewItem = {
  id: string;
  kind: ProfileChangeKind;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  professional: { id: string | null; name: string; slug: string | null; email: string | null };
  /** Name requests. */
  currentName: string | null;
  requestedName: string | null;
  approvedName: string | null;
  reason: string | null;
  /** Photo requests: the live photo, and the one she asked for (short-lived link). */
  currentPhotoUrl: string | null;
  requestedPhotoUrl: string | null;
};

type ReviewRow = ProfileChangeRow & {
  before_snapshot: Record<string, unknown> | null;
  approved_details: Record<string, unknown> | null;
  professional_id: string | null;
  requester_name: string | null;
  requester_email: string | null;
};

const REVIEW_COLUMNS =
  "id, request_type, status, details, before_snapshot, approved_details, professional_id, requester_name, requester_email, created_at, decided_at, decision_note";

/** Open requests (oldest first), then the latest decisions. */
export async function loadProfileChangesForReview(
  service: SupabaseClient,
  types: readonly ProfileChangeRequestType[] = PROFILE_CHANGE_REQUEST_TYPES,
): Promise<ProfileChangeReviewItem[]> {
  const [pending, decided] = await Promise.all([
    service
      .from("request_log")
      .select(REVIEW_COLUMNS)
      .in("request_type", [...types])
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    service
      .from("request_log")
      .select(REVIEW_COLUMNS)
      .in("request_type", [...types])
      .in("status", ["approved", "rejected", "withdrawn"])
      .order("decided_at", { ascending: false })
      .limit(RECENT_DECISIONS),
  ]);
  if (pending.error) throw new Error(`profile change review: ${pending.error.message}`);
  if (decided.error) throw new Error(`profile change review: ${decided.error.message}`);
  const rows = [...(pending.data ?? []), ...(decided.data ?? [])] as ReviewRow[];

  const ids = [...new Set(rows.map((row) => row.professional_id).filter((id): id is string => Boolean(id)))];
  const slugs = new Map<string, { name: string; slug: string | null; avatar: string | null }>();
  if (ids.length > 0) {
    const { data } = await service.from("professionals").select("id, name, slug, avatar_url").in("id", ids);
    for (const pro of data ?? []) {
      slugs.set(String(pro.id), {
        name: String(pro.name ?? ""),
        slug: text(pro.slug),
        avatar: text(pro.avatar_url),
      });
    }
  }

  // Only open photo requests need a link to the waiting photo.
  const requestedPhotos = new Map<string, string | null>();
  await Promise.all(
    rows
      .filter((row) => row.status === "pending" && row.request_type === PHOTO_CHANGE_REQUEST_TYPE)
      .map(async (row) => {
        const path = text((row.details as Record<string, unknown> | null)?.photo_path);
        requestedPhotos.set(row.id, await signedPhotoUrl(service, path));
      }),
  );

  return rows.map((row) => {
    const live = row.professional_id ? slugs.get(row.professional_id) : undefined;
    const details = (row.details ?? {}) as Record<string, unknown>;
    return {
      currentPhotoUrl:
        row.status === "pending" && row.request_type === PHOTO_CHANGE_REQUEST_TYPE
          ? publicAvatarUrl(service, live?.avatar)
          : null,
      requestedPhotoUrl: requestedPhotos.get(row.id) ?? null,
      id: row.id,
      kind: profileChangeKind(row.request_type),
      status: row.status as ProfileChangeReviewItem["status"],
      createdAt: row.created_at,
      decidedAt: row.decided_at,
      decisionNote: row.decision_note,
      professional: {
        id: row.professional_id,
        name: live?.name ?? row.requester_name ?? "",
        slug: live?.slug ?? null,
        email: row.requester_email,
      },
      currentName: text(row.before_snapshot?.name),
      requestedName: text(details.name),
      approvedName: row.status === "approved" ? text(row.approved_details?.name) ?? text(details.name) : null,
      reason: text(details.reason),
    };
  });
}

export async function countPendingProfileChanges(service: SupabaseClient): Promise<number> {
  const { count, error } = await service
    .from("request_log")
    .select("id", { count: "exact", head: true })
    .in("request_type", [...PROFILE_CHANGE_REQUEST_TYPES])
    .eq("status", "pending");
  if (error) {
    console.error("[DocCy] profile change count", error);
    return 0;
  }
  return count ?? 0;
}

type PendingRequest = {
  id: string;
  type: ProfileChangeRequestType;
  details: Record<string, unknown>;
  professional: { id: string; name: string; slug: string | null; authUserId: string | null; email: string };
};

async function loadPendingProfileChange(
  service: SupabaseClient,
  requestId: string,
): Promise<HttpResult<{ request: PendingRequest }>> {
  const { data: row, error } = await service
    .from("request_log")
    .select("id, request_type, status, details, professional_id, requester_email")
    .eq("id", requestId)
    .maybeSingle();
  if (error) {
    console.error("[DocCy] profile change load", error);
    return { ok: false, status: 500, message: "Could not load the request. Try again in a moment." };
  }
  if (!row || !(PROFILE_CHANGE_REQUEST_TYPES as readonly string[]).includes(String(row.request_type))) {
    return { ok: false, status: 404, message: "That request does not exist." };
  }
  if (row.status !== "pending") return { ok: false, ...profileChangeDbErrorMessage({ code: "55000" }, "decide") };
  const { data: pro } = row.professional_id
    ? await service
        .from("professionals")
        .select("id, name, slug, auth_user_id, registration_email, email")
        .eq("id", row.professional_id)
        .maybeSingle()
    : { data: null };
  if (!pro) return { ok: false, ...profileChangeDbErrorMessage({ code: "P0002" }, "decide") };
  return {
    ok: true,
    request: {
      id: String(row.id),
      type: row.request_type as ProfileChangeRequestType,
      details: (row.details ?? {}) as Record<string, unknown>,
      professional: {
        id: String(pro.id),
        name: String(pro.name ?? ""),
        slug: text(pro.slug),
        authUserId: text(pro.auth_user_id),
        email: String(pro.registration_email ?? pro.email ?? row.requester_email ?? ""),
      },
    },
  };
}

/** Addresses among `candidates` that other profiles use or that still forward to them. */
async function takenSlugs(service: SupabaseClient, professionalId: string, candidates: string[]): Promise<Set<string>> {
  const lower = candidates.map((candidate) => candidate.toLowerCase());
  const [live, forwards] = await Promise.all([
    service.from("professionals").select("slug").in("slug", lower).eq("is_archived", false).neq("id", professionalId),
    service.from("professional_slug_redirects").select("slug").in("slug", lower).neq("professional_id", professionalId),
  ]);
  if (live.error) throw new Error(`slug lookup: ${live.error.message}`);
  if (forwards.error) throw new Error(`slug redirect lookup: ${forwards.error.message}`);
  return new Set(
    [...(live.data ?? []), ...(forwards.data ?? [])].map((row) => String(row.slug ?? "").trim().toLowerCase()),
  );
}

async function firstClinicDistrict(service: SupabaseClient, professionalId: string): Promise<string | null> {
  const { data } = await service
    .from("professional_clinics")
    .select("sort_order, clinics(district)")
    .eq("professional_id", professionalId)
    .order("sort_order", { ascending: true })
    .limit(1);
  const clinic = (data?.[0] as { clinics?: { district?: string | null } | { district?: string | null }[] } | undefined)
    ?.clinics;
  const district = Array.isArray(clinic) ? clinic[0]?.district : clinic?.district;
  return text(district);
}

/**
 * A founder approves a name change, as she asked or with their correction. The
 * profile's address follows the name; the old one forwards. She is emailed.
 */
export async function approveNameChangeRequest(
  service: SupabaseClient,
  input: { requestId: string; adminId: string; name?: unknown; note?: unknown },
): Promise<HttpResult<{ name: string; slug: string }>> {
  const loaded = await loadPendingProfileChange(service, input.requestId);
  if (loaded.ok === false) return loaded;
  const { request } = loaded;
  if (request.type !== NAME_CHANGE_REQUEST_TYPE) {
    return { ok: false, status: 400, message: "That request is not a name change." };
  }
  const asked = { name: text(request.details.name) ?? "", reason: text(request.details.reason) };
  const reviewed = reviewedNameChange(asked, input.name);
  if (reviewed.ok === false) return { ok: false, status: 400, message: reviewed.message };

  const pro = request.professional;
  let slug: string;
  try {
    const slugInput = {
      name: reviewed.name,
      district: await firstClinicDistrict(service, pro.id),
      authUserId: pro.authUserId ?? pro.id,
    };
    slug = pickNameChangeSlug({
      ...slugInput,
      currentSlug: pro.slug,
      taken: await takenSlugs(service, pro.id, nameChangeSlugCandidates(slugInput)),
    });
  } catch (error) {
    console.error("[DocCy] name change approve: address lookup failed", error);
    return { ok: false, status: 500, message: "Could not pick the profile address. Try again in a moment." };
  }

  const { error } = await service.rpc("request_approve", {
    p_request_id: request.id,
    p_admin_id: input.adminId,
    p_corrected_details: reviewed.corrected,
    p_note: typeof input.note === "string" && input.note.trim() ? input.note.trim() : null,
    p_options: { slug },
  });
  if (error) {
    console.error("[DocCy] name change approve failed", error);
    return { ok: false, ...profileChangeDbErrorMessage(error, "decide") };
  }

  await sendRegistrationDecisionEmail(
    pro.email,
    buildProfileChangeApprovedEmail({
      kind: "name",
      firstName: firstName(reviewed.name),
      siteUrl: getPublicBookingBaseUrl(),
      profilePath: `/en/${slug}`,
      approvedName: reviewed.name,
      requestedName: asked.name,
      addressChanged: slug !== (pro.slug ?? "").toLowerCase(),
    }),
  );
  return { ok: true, name: reviewed.name, slug };
}

/**
 * A founder approves a new photo: it is copied to the public bucket and goes live.
 * She is emailed.
 */
export async function approvePhotoChangeRequest(
  service: SupabaseClient,
  input: { requestId: string; adminId: string; note?: unknown },
): Promise<HttpResult<{ avatarPath: string }>> {
  const loaded = await loadPendingProfileChange(service, input.requestId);
  if (loaded.ok === false) return loaded;
  const { request } = loaded;
  if (request.type !== PHOTO_CHANGE_REQUEST_TYPE) {
    return { ok: false, status: 400, message: "That request is not a photo change." };
  }
  const pro = request.professional;
  const photoPath = text(request.details.photo_path);

  let avatarPath: string;
  try {
    if (!photoPath) throw new Error("the request has no photo");
    const download = await service.storage.from(REGISTRATION_UPLOADS_BUCKET).download(photoPath);
    if (download.error || !download.data) throw new Error(`photo download: ${download.error?.message}`);
    avatarPath = approvedAvatarPath(pro.authUserId ?? pro.id, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const upload = await service.storage.from("avatars").upload(avatarPath, download.data, {
      contentType: download.data.type || "image/jpeg",
      upsert: false,
    });
    if (upload.error) throw new Error(`photo upload: ${upload.error.message}`);
  } catch (error) {
    console.error("[DocCy] photo change approve: copy failed", error);
    return { ok: false, status: 500, message: "Could not publish the photo. Try again, or deny the request." };
  }

  const { error } = await service.rpc("request_approve", {
    p_request_id: request.id,
    p_admin_id: input.adminId,
    p_corrected_details: null,
    p_note: typeof input.note === "string" && input.note.trim() ? input.note.trim() : null,
    p_options: { avatar_path: avatarPath },
  });
  if (error) {
    await service.storage.from("avatars").remove([avatarPath]);
    console.error("[DocCy] photo change approve failed", error);
    return { ok: false, ...profileChangeDbErrorMessage(error, "decide") };
  }

  await sendRegistrationDecisionEmail(
    pro.email,
    buildProfileChangeApprovedEmail({
      kind: "photo",
      firstName: firstName(pro.name),
      siteUrl: getPublicBookingBaseUrl(),
      profilePath: `/en/${pro.slug ?? ""}`,
    }),
  );
  return { ok: true, avatarPath };
}

/** Approves whichever kind the request is. */
export async function approveProfileChangeRequest(
  service: SupabaseClient,
  input: { requestId: string; adminId: string; name?: unknown; note?: unknown },
): Promise<HttpResult<{ kind: ProfileChangeKind }>> {
  const { data: row } = await service.from("request_log").select("request_type").eq("id", input.requestId).maybeSingle();
  if (row?.request_type === PHOTO_CHANGE_REQUEST_TYPE) {
    const result = await approvePhotoChangeRequest(service, input);
    return result.ok === false ? result : { ok: true, kind: "photo" };
  }
  const result = await approveNameChangeRequest(service, input);
  return result.ok === false ? result : { ok: true, kind: "name" };
}

/** A founder denies a name or photo change with a reason; she is emailed it. */
export async function denyProfileChangeRequest(
  service: SupabaseClient,
  input: { requestId: string; adminId: string; reason: unknown },
): Promise<HttpResult<{ kind: ProfileChangeKind }>> {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason) return { ok: false, status: 400, message: "Give a reason: the professional is told why." };
  const loaded = await loadPendingProfileChange(service, input.requestId);
  if (loaded.ok === false) return loaded;
  const { request } = loaded;

  const { error } = await service.rpc("request_reject", {
    p_request_id: request.id,
    p_admin_id: input.adminId,
    p_note: reason,
  });
  if (error) {
    console.error("[DocCy] profile change deny failed", error);
    return { ok: false, ...profileChangeDbErrorMessage(error, "decide") };
  }
  const kind = profileChangeKind(request.type);
  await sendRegistrationDecisionEmail(
    request.professional.email,
    buildProfileChangeDeniedEmail({
      kind,
      firstName: firstName(request.professional.name),
      siteUrl: getPublicBookingBaseUrl(),
      reason,
    }),
  );
  return { ok: true, kind };
}
