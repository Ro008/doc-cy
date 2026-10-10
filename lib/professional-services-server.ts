import type { SupabaseClient } from "@supabase/supabase-js";

import type { HttpResult } from "@/lib/profile-change-requests-server";
import { MAX_SERVICES, parseSavedServices, type SavedService, type ServiceInput } from "@/lib/settings-services";

/**
 * Settings → Services & prices (user, 2026-10-10): she adds, changes and removes
 * services as she pleases. No founder; each database function makes the change and its
 * request_log row together, and keeps the rules (at most 20, no name twice).
 */

const NAME_TAKEN = "You already list a service with this name.";
const NOT_HERS = "That service is not on your list.";

function savedService(data: unknown): SavedService | null {
  return parseSavedServices([(data as { service?: unknown } | null)?.service])[0] ?? null;
}

/** Adds one service (professional_service_add). */
export async function addProfessionalService(
  service: SupabaseClient,
  input: { professionalId: string; service: ServiceInput },
): Promise<HttpResult<{ service: SavedService }>> {
  const failed = { ok: false as const, status: 500, message: "Could not add the service. Please try again." };
  const { data, error } = await service.rpc("professional_service_add", {
    p_professional_id: input.professionalId,
    p_name: input.service.name,
    p_price: input.service.price,
  });
  if (error) {
    if (error.code === "23514") {
      return {
        ok: false,
        status: 409,
        message: `You can list up to ${MAX_SERVICES} services. Remove one to add another.`,
      };
    }
    if (error.code === "23505") return { ok: false, status: 409, message: NAME_TAKEN };
    console.error("[DocCy] service add", error);
    return failed;
  }
  const saved = savedService(data);
  if (!saved) {
    console.error("[DocCy] service add: unexpected result", data);
    return failed;
  }
  return { ok: true, service: saved };
}

/** Changes the name or price of one of her services (professional_service_update). */
export async function updateProfessionalService(
  service: SupabaseClient,
  input: { professionalId: string; serviceId: string; service: ServiceInput },
): Promise<HttpResult<{ service: SavedService; changed: boolean }>> {
  const failed = { ok: false as const, status: 500, message: "Could not save the service. Please try again." };
  const { data, error } = await service.rpc("professional_service_update", {
    p_professional_id: input.professionalId,
    p_service_id: input.serviceId,
    p_name: input.service.name,
    p_price: input.service.price,
  });
  if (error) {
    // Not hers, or not an id at all (22P02): nothing to change.
    if (error.code === "P0002" || error.code === "22P02") return { ok: false, status: 404, message: NOT_HERS };
    if (error.code === "23505") return { ok: false, status: 409, message: NAME_TAKEN };
    console.error("[DocCy] service change", error);
    return failed;
  }
  const saved = savedService(data);
  if (!saved) {
    console.error("[DocCy] service change: unexpected result", data);
    return failed;
  }
  return { ok: true, service: saved, changed: Boolean((data as { request_id?: unknown }).request_id) };
}

/** Removes one of her services by its id (professional_service_remove). */
export async function removeProfessionalService(
  service: SupabaseClient,
  input: { professionalId: string; serviceId: string },
): Promise<HttpResult<object>> {
  const { error } = await service.rpc("professional_service_remove", {
    p_professional_id: input.professionalId,
    p_service_id: input.serviceId,
  });
  if (error) {
    if (error.code === "P0002" || error.code === "22P02") return { ok: false, status: 404, message: NOT_HERS };
    console.error("[DocCy] service remove", error);
    return { ok: false, status: 500, message: "Could not remove the service. Please try again." };
  }
  return { ok: true };
}
