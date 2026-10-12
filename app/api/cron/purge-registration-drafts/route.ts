import { NextResponse } from "next/server";

import { deniedPhotoWindow, purgeDeniedPhotos } from "@/lib/photo-cleanup";
import {
  PROFESSIONAL_REGISTRATION_REQUEST_TYPE,
  REGISTRATION_UPLOADS_BUCKET,
} from "@/lib/professional-registration-request";
import { PHOTO_CHANGE_REQUEST_TYPE } from "@/lib/profile-change-requests";
import {
  purgeExpiredRegistrationDrafts,
  type ExpiredRegistrationDraft,
} from "@/lib/registration-drafts-purge";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Registration drafts still waiting for the confirmation link after this long are deleted. */
const DRAFT_LIFETIME = "7 days";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Daily (vercel.json): deletes expired registration drafts, their photos and new logins,
 * then the photos of requests denied (or withdrawn) about 90 days ago.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const service = createServiceRoleClient();
  if (!service) {
    return NextResponse.json({ ok: false, error: "service role missing" }, { status: 500 });
  }

  const result = await purgeExpiredRegistrationDrafts({
    listExpired: async () => {
      const { data, error } = await service.rpc("request_drafts_expired", {
        p_older_than: DRAFT_LIFETIME,
      });
      if (error) throw new Error(error.message);
      const drafts = (data ?? []) as Omit<ExpiredRegistrationDraft, "login_has_history">[];
      if (drafts.length === 0) return [];

      // A login with an earlier request or a profile is someone's account: keep it.
      const ids = drafts.map((d) => d.auth_user_id);
      const [requests, professionals] = await Promise.all([
        service.from("request_log").select("applicant_auth_user_id").in("applicant_auth_user_id", ids),
        service.from("professionals").select("auth_user_id").in("auth_user_id", ids),
      ]);
      if (requests.error) throw new Error(requests.error.message);
      if (professionals.error) throw new Error(professionals.error.message);
      const withHistory = new Set([
        ...(requests.data ?? []).map((r) => String(r.applicant_auth_user_id)),
        ...(professionals.data ?? []).map((p) => String(p.auth_user_id)),
      ]);
      return drafts.map((d) => ({ ...d, login_has_history: withHistory.has(d.auth_user_id) }));
    },
    removePhoto: async (path) => {
      const { error } = await service.storage.from(REGISTRATION_UPLOADS_BUCKET).remove([path]);
      if (error) throw new Error(error.message);
    },
    // The draft goes with the login (ON DELETE CASCADE).
    deleteLogin: async (authUserId) => {
      const { error } = await service.auth.admin.deleteUser(authUserId);
      if (error) throw new Error(error.message);
    },
    deleteDraft: async (draftId) => {
      const { error } = await service.from("request_drafts").delete().eq("id", draftId);
      if (error) throw new Error(error.message);
    },
  });

  const removePhoto = async (path: string) => {
    const { error } = await service.storage.from(REGISTRATION_UPLOADS_BUCKET).remove([path]);
    if (error) throw new Error(error.message);
  };
  const deniedPhotos = await purgeDeniedPhotos({
    listDenied: async () => {
      const { decidedFrom, decidedBefore } = deniedPhotoWindow(new Date());
      const { data, error } = await service
        .from("request_log")
        .select("id, details")
        .in("request_type", [PHOTO_CHANGE_REQUEST_TYPE, PROFESSIONAL_REGISTRATION_REQUEST_TYPE])
        .in("status", ["rejected", "withdrawn"])
        .gte("decided_at", decidedFrom)
        .lt("decided_at", decidedBefore);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({ id: String(row.id), details: row.details }));
    },
    removePhoto,
  });

  const failed = result.failed + deniedPhotos.failed;
  console.log("[DocCy][purge-registration-drafts]", JSON.stringify({ ...result, deniedPhotos }));
  return NextResponse.json({ ok: failed === 0, ...result, deniedPhotos }, { status: failed === 0 ? 200 : 500 });
}

export async function POST(request: Request) {
  return GET(request);
}
