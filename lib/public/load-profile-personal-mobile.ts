import type { SupabaseClient } from "@supabase/supabase-js";
import { publicPersonalMobile } from "@/lib/public/profile-personal-mobile";

/**
 * Server-only (service role): her personal mobile when patients may see it, else null.
 * The rule is `publicPersonalMobile`; the profile page keeps only whether there is one,
 * and the reveal route sends the number after the click.
 */
export async function loadPublicPersonalMobile(
  supabase: SupabaseClient,
  professionalId: string,
): Promise<string | null> {
  const [professional, settings] = await Promise.all([
    supabase
      .from("professionals")
      .select("mobile_number, is_registered, is_archived")
      .eq("id", professionalId)
      .maybeSingle(),
    supabase
      .from("professional_settings")
      .select("show_mobile_on_profile")
      .eq("professional_id", professionalId)
      .maybeSingle(),
  ]);
  if (professional.error || settings.error) {
    console.error(
      "[DocCy] personal mobile lookup failed:",
      professional.error?.message ?? settings.error?.message,
    );
    return null;
  }
  return publicPersonalMobile(professional.data, settings.data);
}
