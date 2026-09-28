import type { SupabaseClient } from "@supabase/supabase-js";

import { isTestDoctorRegistrationEmail } from "@/lib/doctor-test-profile";
import { allocateUniqueDoctorSlug } from "@/lib/doctor-slug";
import {
  PROFESSIONAL_REGISTRATION_REQUEST_TYPE,
  REGISTRATION_UPLOADS_BUCKET,
  parseProfessionalRegistrationDetails,
  registrationRequesterName,
  type ProfessionalRegistrationDetails,
} from "@/lib/professional-registration-request";
import {
  buildRegistrationApprovedEmail,
  buildRegistrationDeniedEmail,
  describeRegistrationCorrections,
  sendRegistrationDecisionEmail,
} from "@/lib/registration-decision-emails";
import { getPublicBookingBaseUrl } from "@/lib/site-url";
import { reviewableRegistrationRows } from "@/lib/registration-review-filter";
import {
  approvalErrorMessage,
  registrationContactConflictMessage,
  approvedAvatarPath,
  claimedListingKeepsSlug,
  parseListingUrl,
  validateApprovedRegistrationDetails,
} from "@/lib/registration-approval";
import { checkProfessionalContact } from "@/lib/professional-contact-check";
import type { ProfessionalContactUse } from "@/lib/professional-contact";

/**
 * Server side of the dashboard's Requests section for professional_registration:
 * loading requests to review, approving (request_approve, one transaction) and
 * denying (request_reject). Service role only; callers check the admin first.
 */

export type ReviewClinicInfo = { id: string; name: string; address: string | null; district: string | null };

export type ReviewListing = { id: string; name: string; slug: string; path: string };

export type RegistrationReviewItem = {
  id: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  requesterName: string;
  isTest: boolean;
  details: ProfessionalRegistrationDetails;
  /** What was approved (founders' corrections), when they changed anything. */
  approvedDetails: ProfessionalRegistrationDetails | null;
  outcome: Record<string, unknown> | null;
  /** Short-lived signed URL of the applicant's photo (private bucket). */
  photoUrl: string | null;
  /** The DocCy clinics the applicant picked, by id. */
  clinics: Record<string, ReviewClinicInfo>;
  /** The listing claimed with "Claim this Profile", if any. */
  claimedListing: ReviewListing | null;
  /** Pending only: whether the email / mobile already belong to another real professional. */
  contactInUse: ProfessionalContactUse | null;
};

type HttpResult<T> = ({ ok: true } & T) | { ok: false; status: number; message: string };

const PHOTO_URL_SECONDS = 60 * 60;
const RECENT_DECISIONS = 15;

export async function signedRegistrationPhotoUrl(
  service: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await service.storage.from(REGISTRATION_UPLOADS_BUCKET).createSignedUrl(path, PHOTO_URL_SECONDS);
  return data?.signedUrl ?? null;
}

async function listingSummary(service: SupabaseClient, id: string): Promise<ReviewListing | null> {
  const { data } = await service.from("professionals").select("id, name, slug").eq("id", id).maybeSingle();
  if (!data?.slug) return null;
  return { id: String(data.id), name: String(data.name ?? ""), slug: String(data.slug), path: `/en/${data.slug}` };
}

/**
 * Pending requests (oldest first) and the latest decisions, without the rows no
 * founder can act on (see `reviewableRegistrationRows`); `hiddenPending` counts the
 * pending ones left out.
 */
export async function loadRegistrationRequestsForReview(
  service: SupabaseClient,
): Promise<{ items: RegistrationReviewItem[]; hiddenPending: number }> {
  const select =
    "id, status, created_at, decided_at, decision_note, requester_name, requester_email, applicant_auth_user_id, details, approved_details, outcome";
  const [pending, decided] = await Promise.all([
    service
      .from("request_log")
      .select(select)
      .eq("request_type", PROFESSIONAL_REGISTRATION_REQUEST_TYPE)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    service
      .from("request_log")
      .select(select)
      .eq("request_type", PROFESSIONAL_REGISTRATION_REQUEST_TYPE)
      .neq("status", "pending")
      .order("decided_at", { ascending: false })
      // Read more than shown: decisions on automated-test addresses are filtered out.
      .limit(RECENT_DECISIONS * 10),
  ]);
  if (pending.error) throw new Error(`requests: ${pending.error.message}`);
  if (decided.error) throw new Error(`requests: ${decided.error.message}`);

  const pendingView = reviewableRegistrationRows(pending.data ?? []);
  const decidedView = reviewableRegistrationRows(decided.data ?? []);
  const rows = [...pendingView.rows, ...decidedView.rows.slice(0, RECENT_DECISIONS)];
  const parsed = rows
    .map((row) => ({ row, details: parseProfessionalRegistrationDetails(row.details) }))
    .filter((entry): entry is { row: (typeof rows)[number]; details: ProfessionalRegistrationDetails } =>
      Boolean(entry.details),
    );

  const clinicIds = new Set<string>();
  for (const { row, details } of parsed) {
    const approved = parseProfessionalRegistrationDetails(row.approved_details);
    for (const clinic of [...details.clinics, ...(approved?.clinics ?? [])]) {
      if (clinic.clinic_id) clinicIds.add(clinic.clinic_id);
    }
  }
  const clinics: Record<string, ReviewClinicInfo> = {};
  if (clinicIds.size > 0) {
    const { data } = await service.from("clinics").select("id, name, address, district").in("id", [...clinicIds]);
    for (const clinic of data ?? []) {
      clinics[String(clinic.id)] = {
        id: String(clinic.id),
        name: String(clinic.name ?? ""),
        address: clinic.address ?? null,
        district: clinic.district ?? null,
      };
    }
  }

  const items = await Promise.all(
    parsed.map(async ({ row, details }) => {
      const approved = parseProfessionalRegistrationDetails(row.approved_details);
      return {
        id: String(row.id),
        status: row.status as RegistrationReviewItem["status"],
        createdAt: String(row.created_at),
        decidedAt: row.decided_at ? String(row.decided_at) : null,
        decisionNote: row.decision_note ?? null,
        requesterName: String(row.requester_name ?? registrationRequesterName(details)),
        isTest: isTestDoctorRegistrationEmail(String(row.requester_email ?? details.email)),
        details,
        approvedDetails: approved,
        outcome: (row.outcome as Record<string, unknown> | null) ?? null,
        photoUrl: row.status === "pending" ? await signedRegistrationPhotoUrl(service, details.photo?.path) : null,
        clinics,
        claimedListing: details.claimed_professional_id
          ? await listingSummary(service, details.claimed_professional_id)
          : null,
        contactInUse:
          row.status === "pending" ? await reviewContactInUse(service, approved ?? details, row.applicant_auth_user_id) : null,
      };
    }),
  );
  return { items, hiddenPending: pendingView.hiddenPending };
}

/** Pending requests founders can act on (their applicant still has a login), for tab badges. */
/** The review still shows the request if this lookup fails; approving checks again. */
async function reviewContactInUse(
  service: SupabaseClient,
  details: ProfessionalRegistrationDetails,
  applicantAuthUserId: string | null,
): Promise<ProfessionalContactUse | null> {
  try {
    return await checkProfessionalContact(service, {
      email: details.email,
      mobile: details.mobile,
      applicantAuthUserId,
    });
  } catch (error) {
    console.error("[requests] contact check failed", error);
    return null;
  }
}

export async function countReviewablePendingRequests(service: SupabaseClient): Promise<number> {
  const { count, error } = await service
    .from("request_log")
    .select("id", { count: "exact", head: true })
    .eq("request_type", PROFESSIONAL_REGISTRATION_REQUEST_TYPE)
    .eq("status", "pending")
    .not("applicant_auth_user_id", "is", null);
  if (error) {
    console.error("[requests] pending count failed", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Resolves a pasted public URL to an unregistered listing founders can claim for a request. */
export async function lookupClaimableListing(
  service: SupabaseClient,
  url: string,
): Promise<HttpResult<{ listing: ReviewListing }>> {
  const slug = parseListingUrl(url);
  if (!slug) {
    return { ok: false, status: 400, message: "That is not a profile URL (it should look like https://www.mydoccy.com/en/name)." };
  }
  let { data: listing } = await service
    .from("professionals")
    .select("id, name, slug, is_registered, is_archived")
    .ilike("slug", slug)
    .eq("is_archived", false)
    .maybeSingle();
  if (!listing) {
    const { data: redirect } = await service
      .from("professional_slug_redirects")
      .select("professional_id")
      .eq("slug", slug)
      .maybeSingle();
    if (redirect?.professional_id) {
      ({ data: listing } = await service
        .from("professionals")
        .select("id, name, slug, is_registered, is_archived")
        .eq("id", redirect.professional_id)
        .maybeSingle());
    }
  }
  if (!listing) return { ok: false, status: 404, message: "No listing has that URL." };
  if (listing.is_registered || listing.is_archived) {
    return { ok: false, status: 409, message: "That profile is already registered: only unregistered listings can be claimed." };
  }
  return {
    ok: true,
    listing: { id: String(listing.id), name: String(listing.name ?? ""), slug: String(listing.slug), path: `/en/${listing.slug}` },
  };
}

type PendingRequest = {
  id: string;
  applicantAuthUserId: string;
  details: ProfessionalRegistrationDetails;
};

async function loadPendingRegistration(service: SupabaseClient, requestId: string): Promise<HttpResult<{ request: PendingRequest }>> {
  const { data, error } = await service
    .from("request_log")
    .select("id, request_type, status, details, applicant_auth_user_id")
    .eq("id", requestId)
    .maybeSingle();
  if (error) return { ok: false, status: 500, message: "Could not load the request." };
  if (!data || data.request_type !== PROFESSIONAL_REGISTRATION_REQUEST_TYPE) {
    return { ok: false, status: 404, message: "Request not found." };
  }
  if (data.status !== "pending") return { ok: false, status: 409, message: `This request is already ${data.status}.` };
  const details = parseProfessionalRegistrationDetails(data.details);
  if (!details) return { ok: false, status: 500, message: "The request details are unreadable." };
  if (!data.applicant_auth_user_id) {
    return { ok: false, status: 409, message: "The applicant's login no longer exists." };
  }
  return { ok: true, request: { id: String(data.id), applicantAuthUserId: String(data.applicant_auth_user_id), details } };
}

function statusForDbError(code: string | null | undefined): number {
  if (code === "22023") return 400;
  if (code === "42501") return 403;
  if (code === "55000" || code === "P0002" || code === "23505") return 409;
  return 500;
}

async function copyPhotoToAvatars(
  service: SupabaseClient,
  photoPath: string,
  authUserId: string,
): Promise<string> {
  const download = await service.storage.from(REGISTRATION_UPLOADS_BUCKET).download(photoPath);
  if (download.error || !download.data) throw new Error(`photo download: ${download.error?.message}`);
  const avatarPath = approvedAvatarPath(authUserId, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const upload = await service.storage.from("avatars").upload(avatarPath, download.data, {
    contentType: download.data.type || "image/jpeg",
    upsert: false,
  });
  if (upload.error) throw new Error(`photo upload: ${upload.error.message}`);
  return avatarPath;
}

export async function approveRegistrationRequest(
  service: SupabaseClient,
  input: { requestId: string; adminId: string; details: unknown; trialMonths?: unknown; note?: unknown },
): Promise<HttpResult<{ professionalId: string; slug: string }>> {
  const loaded = await loadPendingRegistration(service, input.requestId);
  if (loaded.ok === false) return loaded;
  const { request } = loaded;

  const edited = validateApprovedRegistrationDetails(request.details, input.details ?? request.details);
  if (edited.ok === false) return { ok: false, status: 400, message: edited.message };
  const unchanged = validateApprovedRegistrationDetails(request.details, request.details);
  const corrected =
    unchanged.ok && JSON.stringify(unchanged.details) === JSON.stringify(edited.details) ? null : edited.details;
  const details = edited.details;

  let trialMonths: number | null = null;
  if (input.trialMonths !== undefined && input.trialMonths !== null && input.trialMonths !== "") {
    const months = Number(input.trialMonths);
    if (!Number.isInteger(months) || months < 0 || months > 24) {
      return { ok: false, status: 400, message: "Trial months must be a whole number from 0 to 24." };
    }
    trialMonths = months;
  }

  // The email and personal mobile must not already be another real professional's.
  let contactUse: ProfessionalContactUse;
  try {
    contactUse = await checkProfessionalContact(service, {
      email: details.email,
      mobile: details.mobile,
      applicantAuthUserId: request.applicantAuthUserId,
    });
  } catch (error) {
    console.error("[requests] approve: contact check failed", error);
    return { ok: false, status: 500, message: "Could not check the email and mobile. Try again in a moment." };
  }
  const contactConflict = registrationContactConflictMessage(contactUse);
  if (contactConflict) return { ok: false, status: 409, message: contactConflict };

  const name = registrationRequesterName(details);
  const district = details.clinics[0]?.district ?? null;
  let slug: string;
  if (details.claimed_professional_id) {
    const listing = await listingSummary(service, details.claimed_professional_id);
    slug =
      listing && claimedListingKeepsSlug(listing.slug, { name, district })
        ? listing.slug
        : await allocateUniqueDoctorSlug(service, { name, district, authUserId: request.applicantAuthUserId });
  } else {
    slug = await allocateUniqueDoctorSlug(service, { name, district, authUserId: request.applicantAuthUserId });
  }

  let avatarPath: string | null = null;
  if (details.photo?.path) {
    try {
      avatarPath = await copyPhotoToAvatars(service, details.photo.path, request.applicantAuthUserId);
    } catch (error) {
      console.error("[requests] approve: photo copy failed", error);
      return { ok: false, status: 500, message: "Could not copy the photo. Try again, or remove it." };
    }
  }

  const { error } = await service.rpc("request_approve", {
    p_request_id: request.id,
    p_admin_id: input.adminId,
    p_corrected_details: corrected,
    p_note: typeof input.note === "string" && input.note.trim() ? input.note.trim() : null,
    p_options: { slug, avatar_path: avatarPath, trial_months: trialMonths },
  });
  if (error) {
    if (avatarPath) await service.storage.from("avatars").remove([avatarPath]);
    console.error("[requests] approve failed", error);
    return { ok: false, status: statusForDbError(error.code), message: approvalErrorMessage(error) };
  }

  const { data: approved } = await service
    .from("request_log")
    .select("professional_id, outcome")
    .eq("id", request.id)
    .single();
  const outcome = (approved?.outcome ?? {}) as { pro_access_until?: string | null };
  await sendRegistrationDecisionEmail(
    request.details.email,
    buildRegistrationApprovedEmail({
      name,
      siteUrl: getPublicBookingBaseUrl(),
      profilePath: `/en/${slug}`,
      accessUntil: outcome.pro_access_until ?? null,
      corrections: describeRegistrationCorrections(request.details, corrected),
    }),
  );
  return { ok: true, professionalId: String(approved?.professional_id ?? ""), slug };
}

export async function denyRegistrationRequest(
  service: SupabaseClient,
  input: { requestId: string; adminId: string; reason: unknown },
): Promise<HttpResult<object>> {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason) return { ok: false, status: 400, message: "Give a reason: the applicant is told why." };
  const loaded = await loadPendingRegistration(service, input.requestId);
  if (loaded.ok === false) return loaded;
  const { error } = await service.rpc("request_reject", {
    p_request_id: input.requestId,
    p_admin_id: input.adminId,
    p_note: reason,
  });
  if (error) {
    console.error("[requests] deny failed", error);
    return { ok: false, status: statusForDbError(error.code), message: approvalErrorMessage(error) };
  }
  await sendRegistrationDecisionEmail(
    loaded.request.details.email,
    buildRegistrationDeniedEmail({
      name: registrationRequesterName(loaded.request.details),
      siteUrl: getPublicBookingBaseUrl(),
      reason,
    }),
  );
  return { ok: true };
}

/** A founder's replacement photo, kept with the request until approval copies it. */
export async function storeReplacementPhoto(
  service: SupabaseClient,
  input: { requestId: string; file: File },
): Promise<HttpResult<{ path: string; url: string | null }>> {
  const loaded = await loadPendingRegistration(service, input.requestId);
  if (loaded.ok === false) return loaded;
  const type = input.file.type.toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(type)) {
    return { ok: false, status: 400, message: "Use a JPEG, PNG or WebP image." };
  }
  if (input.file.size <= 0 || input.file.size > 1024 * 1024) {
    return { ok: false, status: 400, message: "The photo must be under 1 MB." };
  }
  const extension = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const path = `${PROFESSIONAL_REGISTRATION_REQUEST_TYPE}/${loaded.request.applicantAuthUserId}/founder-${Date.now()}.${extension}`;
  const { error } = await service.storage
    .from(REGISTRATION_UPLOADS_BUCKET)
    .upload(path, input.file, { contentType: type, upsert: false });
  if (error) return { ok: false, status: 500, message: "Could not store the photo." };
  return { ok: true, path, url: await signedRegistrationPhotoUrl(service, path) };
}
