import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { requireAdminWrite } from "@/lib/admin-auth";
import { resolveUnregisteredListingFromUrl } from "@/lib/resolve-unregistered-listing-from-url";

type Body = {
  registeredId?: string;
  unregisteredId?: string;
  listingUrl?: string;
  action?: "absorb" | "keep_both";
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const { response: denied } = await requireAdminWrite();
  if (denied) return denied;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Server is not configured." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 });
  }

  const registeredId = String(body.registeredId ?? "").trim();
  let unregisteredId = String(body.unregisteredId ?? "").trim();
  const listingUrl = String(body.listingUrl ?? "").trim();
  const action = body.action === "keep_both" ? "keep_both" : "absorb";

  if (!UUID_RE.test(registeredId)) {
    return NextResponse.json({ message: "registeredId is required." }, { status: 400 });
  }

  if (!UUID_RE.test(unregisteredId) && listingUrl) {
    const resolved = await resolveUnregisteredListingFromUrl(supabase, listingUrl);
    if (resolved.ok === false) {
      return NextResponse.json({ message: resolved.message }, { status: resolved.status });
    }
    unregisteredId = resolved.listing.id;
  }

  if (!UUID_RE.test(unregisteredId)) {
    return NextResponse.json(
      { message: "unregisteredId or listingUrl is required." },
      { status: 400 },
    );
  }
  if (registeredId === unregisteredId) {
    return NextResponse.json({ message: "Ids must differ." }, { status: 400 });
  }

  // "keep both" means: these are two different people, do not absorb. It used to also
  // write a dismissed row to directory_duplicate_suggestions so the automatic signup
  // dedupe would stop proposing the pair. That automation is retired -- a claim now
  // names its own target, and a plain "join as a professional" is checked by hand -- so
  // there is no suggestion left to suppress and the decision is simply to do nothing.
  if (action === "keep_both") {
    return NextResponse.json({ ok: true, action: "keep_both" });
  }

  const { error: absorbErr } = await supabase.rpc("absorb_unregistered_into_registered", {
    p_registered_id: registeredId,
    p_unregistered_id: unregisteredId,
  });
  if (absorbErr) {
    console.error("[pending-twin] absorb failed", absorbErr);
    return NextResponse.json({ message: "Could not absorb listing." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action: "absorb", unregisteredId });
}
