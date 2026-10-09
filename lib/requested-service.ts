import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The service a patient may pick when booking (user, 2026-10-04): optional, one of the
 * professional's own `professional_services`. The database keeps the id and copies the name
 * at booking (`appointments_requested_service_check`), and refuses another professional's
 * service; the routes check first so the patient gets a clear message.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const REQUESTED_SERVICE_NOT_OFFERED = "That service isn't offered by this professional.";

// Optional `undefined` fields on each branch: no strictNullChecks in this project.
export type RequestedServiceIdResult =
  | { ok: true; value: string | null; message?: undefined }
  | { ok: false; message: string; value?: undefined };

/** Body field `professionalServiceId`: missing or empty means no service. */
export function parseRequestedServiceId(value: unknown): RequestedServiceIdResult {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, message: "That service isn't valid." };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!UUID.test(trimmed)) return { ok: false, message: "That service isn't valid." };
  return { ok: true, value: trimmed.toLowerCase() };
}

export type RequestedServiceRow = { id: string; professional_id: string; name: string };

export function requestedServiceRefusal(
  service: RequestedServiceRow | null | undefined,
  professionalId: string,
): string | null {
  if (!service || service.professional_id !== professionalId) return REQUESTED_SERVICE_NOT_OFFERED;
  return null;
}

/**
 * Reads `professionalServiceId` from a booking body and checks it is hers.
 * `{ ok: true, service: null }` when none was chosen.
 */
export async function resolveRequestedService(
  supabase: SupabaseClient,
  professionalId: string,
  value: unknown,
): Promise<
  | { ok: true; service: RequestedServiceRow | null; message?: undefined }
  | { ok: false; message: string; service?: undefined }
> {
  const parsed = parseRequestedServiceId(value);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  if (!parsed.value) return { ok: true, service: null };
  const { data, error } = await supabase
    .from("professional_services")
    .select("id, professional_id, name")
    .eq("id", parsed.value)
    .eq("professional_id", professionalId)
    .maybeSingle();
  if (error) throw error;
  const service = (data as RequestedServiceRow | null) ?? null;
  const refusal = requestedServiceRefusal(service, professionalId);
  if (refusal) return { ok: false, message: refusal };
  return { ok: true, service };
}
