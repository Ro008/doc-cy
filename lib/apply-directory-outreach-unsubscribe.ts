import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeOutreachEmail,
  outreachUnsubscribeTokenIsValid,
  resolveOutreachUnsubscribeSecret,
} from "@/lib/directory-manual-outreach-token";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OutreachUnsubscribeResult =
  | { ok: true; already: boolean }
  | { ok: false; reason: "invalid" | "missing_secret" | "not_configured" | "failed" };

async function resolveEmailForUnsubscribe(
  supabase: SupabaseClient,
  manualId: string,
): Promise<string | null> {
  const { data: listing, error: listingError } = await supabase
    .from("directory_manual")
    .select("email")
    .eq("id", manualId)
    .maybeSingle();

  if (listingError) {
    throw new Error(listingError.message);
  }
  const fromListing = normalizeOutreachEmail(
    (listing as { email?: string | null } | null)?.email,
  );
  if (fromListing) return fromListing;

  const { data: sent, error: sentError } = await supabase
    .from("directory_manual_outreach_sent")
    .select("email")
    .eq("manual_id", manualId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sentError) {
    const code = String((sentError as { code?: string }).code ?? "");
    if (code === "42P01" || /does not exist/i.test(sentError.message ?? "")) {
      return null;
    }
    throw new Error(sentError.message);
  }

  const fromSent = normalizeOutreachEmail((sent as { email?: string | null } | null)?.email);
  return fromSent || null;
}

export async function applyDirectoryOutreachUnsubscribe(input: {
  supabase: SupabaseClient;
  manualId: string;
  token: string;
}): Promise<OutreachUnsubscribeResult> {
  const manualId = String(input.manualId ?? "").trim().toLowerCase();
  const token = String(input.token ?? "").trim().toLowerCase();
  if (!UUID_RE.test(manualId) || !token) {
    return { ok: false, reason: "invalid" };
  }

  const secret = resolveOutreachUnsubscribeSecret();
  if (!secret) {
    return { ok: false, reason: "missing_secret" };
  }

  let email: string | null;
  try {
    email = await resolveEmailForUnsubscribe(input.supabase, manualId);
  } catch (err) {
    console.error(
      "[DocCy][outreach-unsubscribe] lookup_failed",
      err instanceof Error ? err.message : String(err),
    );
    return { ok: false, reason: "failed" };
  }

  if (!email) {
    return { ok: false, reason: "invalid" };
  }

  if (!outreachUnsubscribeTokenIsValid({ manualId, email, token, secret })) {
    return { ok: false, reason: "invalid" };
  }

  const { error } = await input.supabase.from("directory_manual_outreach_unsubscribed").upsert(
    {
      email_normalized: email,
      manual_id: manualId,
    },
    { onConflict: "email_normalized" },
  );

  if (error) {
    const code = String((error as { code?: string }).code ?? "");
    if (code === "42P01" || /does not exist/i.test(error.message ?? "")) {
      return { ok: false, reason: "not_configured" };
    }
    console.error("[DocCy][outreach-unsubscribe] upsert_failed", error.message);
    return { ok: false, reason: "failed" };
  }

  return { ok: true, already: false };
}
