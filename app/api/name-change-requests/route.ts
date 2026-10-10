import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { NAME_CHANGE_REQUEST_TYPE } from "@/lib/profile-change-requests";
import { submitNameChangeRequest, withdrawProfileChangeRequest } from "@/lib/profile-change-requests-server";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Settings → Profile (user, 2026-10-10): the name changes by request. Founders
 * approve or deny it; until then the live name stays.
 * - POST { name, reason } → 201 { request: { id, name, createdAt } } · 400 not a
 *   usable name · 409 a request is already waiting
 * - DELETE withdraws her open request → 200 · 409 already decided
 * Both: 401 signed out · 403 not a professional.
 */
async function signedInProfessionalId(): Promise<{ id: string } | NextResponse> {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const { data: pro } = await supabase.from("professionals").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!pro?.id) return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  return { id: String(pro.id) };
}

export async function POST(req: Request) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { name?: unknown; reason?: unknown } | null;
  const result = await submitNameChangeRequest(service, {
    professionalId: pro.id,
    name: body?.name,
    reason: body?.reason,
  });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ request: result.request }, { status: 201 });
}

export async function DELETE() {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const result = await withdrawProfileChangeRequest(service, {
    professionalId: pro.id,
    type: NAME_CHANGE_REQUEST_TYPE,
  });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ status: "withdrawn" });
}
