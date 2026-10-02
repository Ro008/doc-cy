import type { SupabaseClient } from "@supabase/supabase-js";

/** Open booking requests for future visits (what "Needs your answer" lists). */
export async function countPendingRequests(
  supabase: SupabaseClient,
  professionalId: string,
  nowIso: string = new Date().toISOString(),
): Promise<number | null> {
  const { count, error } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", professionalId)
    .ilike("status", "requested")
    .gt("appointment_datetime", nowIso);
  if (error) {
    console.error("[DocCy] countPendingRequests failed", error);
    return null;
  }
  return count ?? 0;
}

const PENDING_COUNT_EVENT = "doccy:pending-requests-count";

/** The dashboard announces its live count so the nav badge updates without a refetch. */
export function emitPendingRequestsCount(count: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PENDING_COUNT_EVENT, { detail: { count } }));
}

export function subscribePendingRequestsCount(listener: (count: number) => void): () => void {
  function onEvent(event: Event) {
    const count = (event as CustomEvent<{ count?: unknown }>).detail?.count;
    if (typeof count === "number") listener(count);
  }
  window.addEventListener(PENDING_COUNT_EVENT, onEvent);
  return () => window.removeEventListener(PENDING_COUNT_EVENT, onEvent);
}
