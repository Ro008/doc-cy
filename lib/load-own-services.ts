import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingServiceItem } from "@/lib/booking-service-choice";

/**
 * The professional's own services as a plain list (id and name, oldest first), for the
 * optional service choice in "Add manual booking". Read only; a failed read gives an empty
 * list, so the window simply shows no choice.
 */
export async function loadOwnServices(
  supabase: SupabaseClient,
  professionalId: string,
): Promise<BookingServiceItem[]> {
  const { data, error } = await supabase
    .from("professional_services")
    .select("id, name")
    .eq("professional_id", professionalId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[DocCy] own services load failed", error);
    return [];
  }
  return (data ?? [])
    .map((row) => ({ id: String(row.id), name: String(row.name ?? "").trim() }))
    .filter((service) => service.name.length > 0);
}
