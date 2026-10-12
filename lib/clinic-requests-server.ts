import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildClinicAddApprovedEmail,
  buildClinicAddNotifyContent,
  buildClinicDetailsApprovedEmail,
  buildClinicDetailsNotifyContent,
  buildClinicRequestDeniedEmail,
} from "@/lib/clinic-request-emails";
import {
  CLINIC_ADD_REQUEST_TYPE,
  CLINIC_DETAILS_REQUEST_TYPE,
  CLINIC_REQUEST_TYPES,
  clinicChangeLines,
  clinicChangesFromBody,
  clinicRequestDbErrorMessage,
  clinicRequestStates,
  newClinicDetailsFromBody,
  reviewedClinicChanges,
  reviewedNewClinic,
  type ClinicChangeLine,
  type ClinicDetailsChanges,
  type ClinicRequestRow,
  type ClinicRequestStates,
  type ClinicRequestType,
  type NewClinicDetails,
  type PendingClinicAddRequest,
  type PendingClinicDetailsRequest,
} from "@/lib/clinic-requests";
import { isDirectoryCanaryClinicId } from "@/lib/directory-canaries";
import { formatCyprusPhoneDisplay } from "@/lib/phone-link";
import { notifyFounders, type HttpResult } from "@/lib/profile-change-requests-server";
import { sendRegistrationDecisionEmail } from "@/lib/registration-decision-emails";
import { getPublicBookingBaseUrl } from "@/lib/site-url";

/**
 * Server side of the clinic requests (user, 2026-10-11): she sends and withdraws them
 * from Settings → Clinics; founders approve (as asked or corrected) or deny them on
 * the dashboard's Requests tab. Service role only; callers check the session (or the
 * admin) first.
 */

const RECENT_DECISIONS = 15;

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

type Requester = { id: string; name: string; email: string };

async function loadRequester(service: SupabaseClient, professionalId: string): Promise<Requester | null> {
  const { data, error } = await service
    .from("professionals")
    .select("id, name, registration_email, email")
    .eq("id", professionalId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: String(data.id),
    name: String(data.name ?? ""),
    email: String(data.registration_email ?? data.email ?? ""),
  };
}

type OwnClinic = {
  clinicId: string;
  name: string;
  address: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
};

/** One of her clinics, by her link to it; null when the link is not hers (or the clinic is archived). */
async function loadOwnClinic(service: SupabaseClient, professionalId: string, linkId: string): Promise<OwnClinic | null> {
  if (!/^[0-9a-f-]{36}$/i.test(linkId)) return null;
  const { data } = await service
    .from("professional_clinics")
    .select("clinic_id, clinics ( id, name, address, phone, latitude, longitude, is_archived )")
    .eq("id", linkId)
    .eq("professional_id", professionalId)
    .maybeSingle();
  const joined = (data as { clinics?: unknown } | null)?.clinics;
  const clinic = (Array.isArray(joined) ? joined[0] : joined) as
    | {
        id?: string;
        name?: string | null;
        address?: string | null;
        phone?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        is_archived?: boolean;
      }
    | null
    | undefined;
  if (!clinic?.id || clinic.is_archived) return null;
  return {
    clinicId: String(clinic.id),
    name: String(clinic.name ?? "").trim(),
    address: String(clinic.address ?? "").trim(),
    phone: String(clinic.phone ?? "").trim(),
    latitude: typeof clinic.latitude === "number" ? clinic.latitude : null,
    longitude: typeof clinic.longitude === "number" ? clinic.longitude : null,
  };
}

async function countClinicProfessionals(service: SupabaseClient, clinicId: string): Promise<number> {
  const { count } = await service
    .from("professional_clinics")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);
  return count ?? 0;
}

/** What Settings shows: her waiting new clinic, her open details requests, her latest denials. */
export async function loadClinicRequestStates(
  service: SupabaseClient,
  professionalId: string,
): Promise<ClinicRequestStates> {
  const { data, error } = await service
    .from("request_log")
    .select("id, request_type, status, details, created_at, decided_at, decision_note")
    .eq("professional_id", professionalId)
    .in("request_type", [...CLINIC_REQUEST_TYPES])
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(`clinic requests: ${error.message}`);
  return clinicRequestStates((data ?? []) as ClinicRequestRow[]);
}

async function createdAtOf(service: SupabaseClient, requestId: string): Promise<string> {
  const { data } = await service.from("request_log").select("created_at").eq("id", requestId).maybeSingle();
  return String(data?.created_at ?? new Date().toISOString());
}

/** She asks for a clinic DocCy does not have yet. One waiting at a time; founders are told. */
export async function submitClinicAddRequest(
  service: SupabaseClient,
  input: { professionalId: string; clinic: unknown },
): Promise<HttpResult<{ request: PendingClinicAddRequest }>> {
  const pro = await loadRequester(service, input.professionalId);
  if (!pro) return { ok: false, status: 404, message: "Your profile was not found." };
  const checked = newClinicDetailsFromBody(input.clinic);
  if (checked.ok === false) return { ok: false, status: 400, message: checked.message };

  const { data: requestId, error } = await service.rpc("request_submit", {
    p_request_type: CLINIC_ADD_REQUEST_TYPE,
    p_professional_id: input.professionalId,
    p_details: checked.details,
  });
  if (error || !requestId) {
    if (error?.code !== "23505" && error?.code !== "23514") console.error("[DocCy] clinic add request", error);
    return { ok: false, ...clinicRequestDbErrorMessage(error ?? {}, "submit") };
  }
  const content = buildClinicAddNotifyContent({
    professionalName: pro.name,
    clinic: {
      name: checked.details.name,
      address: checked.details.address,
      phone: formatCyprusPhoneDisplay(checked.details.phone),
    },
    siteUrl: getPublicBookingBaseUrl(),
  });
  await notifyFounders(service, {
    requesterEmail: pro.email,
    subject: content.subject,
    text: content.text,
    requestId: String(requestId),
    category: "founder-clinic-add-request",
  });
  return {
    ok: true,
    request: {
      id: String(requestId),
      createdAt: await createdAtOf(service, String(requestId)),
      name: checked.details.name,
      address: checked.details.address,
    },
  };
}

/** She asks to change the name, address or phone of one of her clinics. One open request per clinic. */
export async function submitClinicDetailsRequest(
  service: SupabaseClient,
  input: { professionalId: string; linkId: string; changes: unknown },
): Promise<HttpResult<{ request: PendingClinicDetailsRequest }>> {
  const pro = await loadRequester(service, input.professionalId);
  if (!pro) return { ok: false, status: 404, message: "Your profile was not found." };
  const clinic = await loadOwnClinic(service, input.professionalId, input.linkId);
  if (!clinic) return { ok: false, status: 404, message: "That clinic is not on your profile." };
  const checked = clinicChangesFromBody(input.changes, clinic);
  if (checked.ok === false) return { ok: false, status: 400, message: checked.message };

  const { data: requestId, error } = await service.rpc("request_submit", {
    p_request_type: CLINIC_DETAILS_REQUEST_TYPE,
    p_professional_id: input.professionalId,
    p_details: { link_id: input.linkId, clinic_id: clinic.clinicId, changes: checked.changes },
  });
  if (error || !requestId) {
    if (error?.code !== "23505") console.error("[DocCy] clinic details request", error);
    return { ok: false, ...clinicRequestDbErrorMessage(error ?? {}, "submit") };
  }
  const content = buildClinicDetailsNotifyContent({
    professionalName: pro.name,
    clinicName: clinic.name,
    lines: clinicChangeLines(clinic, checked.changes),
    professionalCount: await countClinicProfessionals(service, clinic.clinicId),
    siteUrl: getPublicBookingBaseUrl(),
  });
  await notifyFounders(service, {
    requesterEmail: pro.email,
    subject: content.subject,
    text: content.text,
    requestId: String(requestId),
    category: "founder-clinic-details-request",
  });
  const { name, address, phone } = checked.changes;
  return {
    ok: true,
    request: {
      id: String(requestId),
      createdAt: await createdAtOf(service, String(requestId)),
      changes: { ...(name ? { name } : {}), ...(address ? { address } : {}), ...(phone ? { phone } : {}) },
    },
  };
}

/** She withdraws her waiting new-clinic request, or her open details request for one clinic. */
export async function withdrawClinicRequest(
  service: SupabaseClient,
  input: { professionalId: string } & ({ type: typeof CLINIC_ADD_REQUEST_TYPE } | { type: typeof CLINIC_DETAILS_REQUEST_TYPE; linkId: string }),
): Promise<HttpResult<{ requestId: string }>> {
  let query = service
    .from("request_log")
    .select("id")
    .eq("professional_id", input.professionalId)
    .eq("request_type", input.type)
    .eq("status", "pending");
  if (input.type === CLINIC_DETAILS_REQUEST_TYPE) {
    const clinic = await loadOwnClinic(service, input.professionalId, input.linkId);
    if (!clinic) return { ok: false, status: 404, message: "That clinic is not on your profile." };
    query = query.eq("details->>clinic_id", clinic.clinicId);
  }
  const { data: pending, error: lookupError } = await query.maybeSingle();
  if (lookupError) {
    console.error("[DocCy] clinic request withdraw lookup", lookupError);
    return { ok: false, status: 500, message: "Could not withdraw the request. Please try again." };
  }
  // Nothing open: a founder decided it meanwhile (or it was already withdrawn).
  if (!pending) return { ok: false, ...clinicRequestDbErrorMessage({ code: "55000" }, "withdraw") };
  const { error } = await service.rpc("request_withdraw", {
    p_request_id: pending.id,
    p_professional_id: input.professionalId,
  });
  if (error) {
    if (error.code !== "55000") console.error("[DocCy] clinic request withdraw", error);
    return { ok: false, ...clinicRequestDbErrorMessage(error, "withdraw") };
  }
  return { ok: true, requestId: String(pending.id) };
}

// ------------------------------------------------------------------ founders

export type ClinicRequestReviewItem = {
  id: string;
  kind: "add" | "details";
  status: "pending" | "approved" | "rejected" | "withdrawn";
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  professional: { id: string | null; name: string; slug: string | null; email: string | null };
  /** The clinic's name: the one she asked for (new), or the clinic's own (details). */
  clinicName: string;
  /** New clinic: what she asked for. */
  newClinic: { name: string; address: string; district: string; phone: string } | null;
  /** New clinic, once approved: whether it was created, or she was joined to one DocCy had. */
  created: boolean | null;
  /** Details: the clinic, what she asked to change (old → new), and who else it touches. */
  clinic: { id: string; slug: string | null } | null;
  lines: ClinicChangeLine[];
  /** Details: the raw values she asked for, for the founders' correction fields. */
  asked: { name: string | null; address: string | null; phone: string | null };
  /** Professionals who work at the clinic, her included. */
  professionalCount: number;
};

type ReviewRow = ClinicRequestRow & {
  before_snapshot: Record<string, unknown> | null;
  approved_details: Record<string, unknown> | null;
  outcome: Record<string, unknown> | null;
  professional_id: string | null;
  requester_name: string | null;
  requester_email: string | null;
};

const REVIEW_COLUMNS =
  "id, request_type, status, details, before_snapshot, approved_details, outcome, professional_id, requester_name, requester_email, created_at, decided_at, decision_note";

const snapshotCurrent = (snapshot: Record<string, unknown> | null) => ({
  name: text(snapshot?.name) ?? "",
  address: text(snapshot?.address) ?? "",
  phone: text(snapshot?.phone) ?? "",
});

/** Open clinic requests (oldest first), then the latest decisions. */
export async function loadClinicRequestsForReview(service: SupabaseClient): Promise<ClinicRequestReviewItem[]> {
  const [pending, decided] = await Promise.all([
    service
      .from("request_log")
      .select(REVIEW_COLUMNS)
      .in("request_type", [...CLINIC_REQUEST_TYPES])
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    service
      .from("request_log")
      .select(REVIEW_COLUMNS)
      .in("request_type", [...CLINIC_REQUEST_TYPES])
      .in("status", ["approved", "rejected", "withdrawn"])
      .order("decided_at", { ascending: false })
      .limit(RECENT_DECISIONS),
  ]);
  if (pending.error) throw new Error(`clinic request review: ${pending.error.message}`);
  if (decided.error) throw new Error(`clinic request review: ${decided.error.message}`);
  const rows = [...(pending.data ?? []), ...(decided.data ?? [])] as ReviewRow[];

  const proIds = [...new Set(rows.map((row) => row.professional_id).filter((id): id is string => Boolean(id)))];
  const pros = new Map<string, { name: string; slug: string | null }>();
  if (proIds.length > 0) {
    const { data } = await service.from("professionals").select("id, name, slug").in("id", proIds);
    for (const pro of data ?? []) pros.set(String(pro.id), { name: String(pro.name ?? ""), slug: text(pro.slug) });
  }

  const clinicIds = [
    ...new Set(
      rows
        .filter((row) => row.request_type === CLINIC_DETAILS_REQUEST_TYPE)
        .map((row) => text((row.details as Record<string, unknown> | null)?.clinic_id))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const clinics = new Map<string, { name: string; slug: string | null }>();
  const counts = new Map<string, number>();
  if (clinicIds.length > 0) {
    const [{ data: clinicRows }, { data: links }] = await Promise.all([
      service.from("clinics").select("id, name, slug").in("id", clinicIds),
      service.from("professional_clinics").select("clinic_id").in("clinic_id", clinicIds),
    ]);
    for (const clinic of clinicRows ?? []) {
      clinics.set(String(clinic.id), { name: String(clinic.name ?? ""), slug: text(clinic.slug) });
    }
    for (const link of links ?? []) {
      const id = String(link.clinic_id);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return rows.map((row) => {
    const live = row.professional_id ? pros.get(row.professional_id) : undefined;
    const approved = row.status === "approved" ? row.approved_details : null;
    const details = (approved ?? row.details ?? {}) as Record<string, unknown>;
    const isAdd = row.request_type === CLINIC_ADD_REQUEST_TYPE;
    const clinicId = isAdd ? null : text((row.details as Record<string, unknown> | null)?.clinic_id);
    const changes = (details.changes ?? {}) as Record<string, unknown>;
    const asked = { name: text(changes.name), address: text(changes.address), phone: text(changes.phone) };
    const current = snapshotCurrent(row.before_snapshot);
    return {
      id: row.id,
      kind: isAdd ? "add" : "details",
      status: row.status as ClinicRequestReviewItem["status"],
      createdAt: row.created_at,
      decidedAt: row.decided_at,
      decisionNote: row.decision_note,
      professional: {
        id: row.professional_id,
        name: live?.name ?? row.requester_name ?? "",
        slug: live?.slug ?? null,
        email: row.requester_email,
      },
      clinicName: isAdd ? text(details.name) ?? "" : current.name || (clinicId ? clinics.get(clinicId)?.name : "") || "",
      newClinic: isAdd
        ? {
            name: text(details.name) ?? "",
            address: text(details.address) ?? "",
            district: text(details.district) ?? "",
            phone: text(details.phone) ?? "",
          }
        : null,
      created: isAdd && row.status === "approved" ? row.outcome?.created === true : null,
      clinic: clinicId ? { id: clinicId, slug: clinics.get(clinicId)?.slug ?? null } : null,
      lines: isAdd
        ? []
        : clinicChangeLines(current, {
            name: asked.name ?? undefined,
            address: asked.address ?? undefined,
            phone: asked.phone ?? undefined,
          }),
      asked,
      professionalCount: clinicId ? counts.get(clinicId) ?? 0 : 0,
    };
  });
}

export async function countPendingClinicRequests(service: SupabaseClient): Promise<number> {
  const { count, error } = await service
    .from("request_log")
    .select("id", { count: "exact", head: true })
    .in("request_type", [...CLINIC_REQUEST_TYPES])
    .eq("status", "pending");
  if (error) {
    console.error("[DocCy] clinic request count", error);
    return 0;
  }
  return count ?? 0;
}

type PendingRequest = {
  id: string;
  type: ClinicRequestType;
  details: Record<string, unknown>;
  snapshot: Record<string, unknown> | null;
  professional: Requester;
};

async function loadPendingClinicRequest(
  service: SupabaseClient,
  requestId: string,
): Promise<HttpResult<{ request: PendingRequest }>> {
  const { data: row, error } = await service
    .from("request_log")
    .select("id, request_type, status, details, before_snapshot, professional_id")
    .eq("id", requestId)
    .maybeSingle();
  if (error) {
    console.error("[DocCy] clinic request load", error);
    return { ok: false, status: 500, message: "Could not load the request. Try again in a moment." };
  }
  if (!row || !(CLINIC_REQUEST_TYPES as readonly string[]).includes(String(row.request_type))) {
    return { ok: false, status: 404, message: "That request does not exist." };
  }
  if (row.status !== "pending") return { ok: false, ...clinicRequestDbErrorMessage({ code: "55000" }, "decide") };
  const professional = row.professional_id ? await loadRequester(service, String(row.professional_id)) : null;
  if (!professional) return { ok: false, ...clinicRequestDbErrorMessage({ code: "P0002" }, "decide") };
  return {
    ok: true,
    request: {
      id: String(row.id),
      type: row.request_type as ClinicRequestType,
      details: (row.details ?? {}) as Record<string, unknown>,
      snapshot: (row.before_snapshot ?? null) as Record<string, unknown> | null,
      professional,
    },
  };
}

type ApproveInput = {
  requestId: string;
  adminId: string;
  name?: unknown;
  address?: unknown;
  phone?: unknown;
  /** New clinic only: DocCy already has it, so she is joined to that one. */
  existingClinicId?: unknown;
  note?: unknown;
};

const noteOf = (note: unknown) => (typeof note === "string" && note.trim() ? note.trim() : null);

/**
 * A founder approves a clinic request, as she asked or with their correction. A new
 * clinic is created and she joins it (or she joins `existingClinicId`); a details
 * change updates the clinic for everyone who works there. She is emailed.
 */
export async function approveClinicRequest(
  service: SupabaseClient,
  input: ApproveInput,
): Promise<HttpResult<{ kind: "add" | "details" }>> {
  const loaded = await loadPendingClinicRequest(service, input.requestId);
  if (loaded.ok === false) return loaded;
  const { request } = loaded;
  const pro = request.professional;
  const siteUrl = getPublicBookingBaseUrl();

  if (request.type === CLINIC_ADD_REQUEST_TYPE) {
    const existingClinicId = typeof input.existingClinicId === "string" ? input.existingClinicId.trim() : "";
    if (existingClinicId && (!/^[0-9a-f-]{36}$/i.test(existingClinicId) || isDirectoryCanaryClinicId(existingClinicId))) {
      return { ok: false, ...clinicRequestDbErrorMessage({ code: "P0002", message: "clinic x not found" }, "decide") };
    }
    const reviewed = existingClinicId
      ? null
      : reviewedNewClinic(request.details as unknown as NewClinicDetails, input);
    if (reviewed && reviewed.ok === false) return { ok: false, status: 400, message: reviewed.message };
    const { error } = await service.rpc("request_approve", {
      p_request_id: request.id,
      p_admin_id: input.adminId,
      p_corrected_details: reviewed?.ok ? reviewed.corrected : null,
      p_note: noteOf(input.note),
      p_options: existingClinicId ? { existing_clinic_id: existingClinicId } : null,
    });
    if (error) {
      console.error("[DocCy] clinic add approve failed", error);
      return { ok: false, ...clinicRequestDbErrorMessage(error, "decide") };
    }
    let clinicName = reviewed?.ok ? reviewed.details.name : "";
    if (existingClinicId) {
      const { data } = await service.from("clinics").select("name").eq("id", existingClinicId).maybeSingle();
      clinicName = String(data?.name ?? "").trim();
    }
    await sendRegistrationDecisionEmail(
      pro.email,
      buildClinicAddApprovedEmail({
        firstName: firstName(pro.name),
        clinicName: clinicName || "Your clinic",
        created: !existingClinicId,
        siteUrl,
      }),
    );
    return { ok: true, kind: "add" };
  }

  const askedChanges = (request.details.changes ?? {}) as ClinicDetailsChanges;
  const reviewed = reviewedClinicChanges(askedChanges, input);
  if (reviewed.ok === false) return { ok: false, status: 400, message: reviewed.message };
  const { error } = await service.rpc("request_approve", {
    p_request_id: request.id,
    p_admin_id: input.adminId,
    p_corrected_details: reviewed.corrected ? { ...request.details, changes: reviewed.changes } : null,
    p_note: noteOf(input.note),
    p_options: null,
  });
  if (error) {
    console.error("[DocCy] clinic details approve failed", error);
    return { ok: false, ...clinicRequestDbErrorMessage(error, "decide") };
  }
  const before = snapshotCurrent(request.snapshot);
  await sendRegistrationDecisionEmail(
    pro.email,
    buildClinicDetailsApprovedEmail({
      firstName: firstName(pro.name),
      clinicName: reviewed.changes.name ?? before.name,
      lines: clinicChangeLines(before, reviewed.changes),
      corrected: reviewed.corrected,
      siteUrl,
    }),
  );
  return { ok: true, kind: "details" };
}

/** A founder denies a clinic request with a reason; she is emailed it. */
export async function denyClinicRequest(
  service: SupabaseClient,
  input: { requestId: string; adminId: string; reason: unknown },
): Promise<HttpResult<{ kind: "add" | "details" }>> {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason) return { ok: false, status: 400, message: "Give a reason: the professional is told why." };
  const loaded = await loadPendingClinicRequest(service, input.requestId);
  if (loaded.ok === false) return loaded;
  const { request } = loaded;

  const { error } = await service.rpc("request_reject", {
    p_request_id: request.id,
    p_admin_id: input.adminId,
    p_note: reason,
  });
  if (error) {
    console.error("[DocCy] clinic request deny failed", error);
    return { ok: false, ...clinicRequestDbErrorMessage(error, "decide") };
  }
  const kind = request.type === CLINIC_ADD_REQUEST_TYPE ? "add" : "details";
  await sendRegistrationDecisionEmail(
    request.professional.email,
    buildClinicRequestDeniedEmail({
      kind,
      firstName: firstName(request.professional.name),
      clinicName: (kind === "add" ? text(request.details.name) : text(request.snapshot?.name)) ?? "the clinic",
      reason,
      siteUrl: getPublicBookingBaseUrl(),
    }),
  );
  return { ok: true, kind };
}
