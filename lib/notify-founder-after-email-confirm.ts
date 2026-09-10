import { createServiceRoleClient } from "@/lib/supabase-service";
import { notifyFounderNewRegistration } from "@/lib/notify-founder-new-registration";
import { professionalAccountEmail } from "@/lib/professional-account-contact";

/**
 * After the professional confirms signup email, notify the founder for license review.
 * Best-effort — confirmation redirect must not depend on Resend.
 */
export async function notifyFounderAfterRegisterEmailConfirm(
  authUserId: string,
): Promise<void> {
  const userId = String(authUserId ?? "").trim();
  if (!userId) return;

  const service = createServiceRoleClient();
  if (!service) {
    console.error("[DocCy] Founder notify after email confirm skipped: no service role");
    return;
  }

  const { data, error } = await service
    .from("professionals")
    .select(
      "id, name, email, registration_email, phone, mobile_number, specialty, is_specialty_approved, ghs_code, address_maps_link",
    )
    .eq("auth_user_id", userId)
    .eq("is_registered", true)
    .maybeSingle();

  if (error) {
    console.error("[DocCy] Founder notify after email confirm lookup failed", error.message);
    return;
  }
  if (!data?.id) {
    console.warn("[DocCy] Founder notify after email confirm: no professional for auth user");
    return;
  }

  const row = data as {
    id: string;
    name?: string | null;
    email?: string | null;
    registration_email?: string | null;
    phone?: string | null;
    mobile_number?: string | null;
    specialty?: string | null;
    is_specialty_approved?: boolean | null;
    ghs_code?: string | null;
    address_maps_link?: string | null;
  };

  await notifyFounderNewRegistration({
    doctorId: row.id,
    fullName: String(row.name ?? "").trim() || "Professional",
    email: professionalAccountEmail(row),
    phone:
      String(row.mobile_number ?? "").trim() || String(row.phone ?? "").trim() || "—",
    specialty: String(row.specialty ?? "").trim() || "—",
    needsSpecialtyReview: row.is_specialty_approved === false,
    claimedDirectory:
      Boolean(String(row.ghs_code ?? "").trim()) ||
      Boolean(String(row.address_maps_link ?? "").trim()),
  });
}
