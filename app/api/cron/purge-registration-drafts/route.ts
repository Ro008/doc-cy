import { NextResponse } from "next/server";

import { REGISTRATION_UPLOADS_BUCKET } from "@/lib/professional-registration-request";
import { confirmRegistrationDraft } from "@/lib/registration-draft-confirm";
import {
  purgeExpiredRegistrationDrafts,
  type ExpiredRegistrationDraft,
} from "@/lib/registration-drafts-purge";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Registration drafts whose email is still unconfirmed after this long are deleted. */
const DRAFT_LIFETIME = "7 days";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Daily (vercel.json): deletes expired unconfirmed registration drafts with their logins and photos. */
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
      return (data ?? []) as ExpiredRegistrationDraft[];
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
    confirmDraft: async (authUserId) => {
      await confirmRegistrationDraft(service, authUserId);
    },
  });

  console.log("[DocCy][purge-registration-drafts]", JSON.stringify(result));
  return NextResponse.json({ ok: result.failed === 0, ...result }, { status: result.failed === 0 ? 200 : 500 });
}

export async function POST(request: Request) {
  return GET(request);
}
