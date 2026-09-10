import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteTestDoctor } from "./test-doctor";

/**
 * Best-effort cleanup for a doctor created through `/register`.
 * Safe to call when signup failed part-way (auth user, no professional row).
 */
export async function deleteRegistrationE2eDoctor(
  admin: SupabaseClient,
  email: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  const { data: byRegistration } = await admin
    .from("professionals")
    .select("id, auth_user_id")
    .ilike("registration_email", normalized);
  const { data: byDirectoryEmail } = await admin
    .from("professionals")
    .select("id, auth_user_id")
    .ilike("email", normalized);

  const rowsById = new Map<string, { id: string; auth_user_id: string }>();
  for (const row of [...(byRegistration ?? []), ...(byDirectoryEmail ?? [])]) {
    const doctorId = String((row as { id?: string }).id ?? "");
    if (!doctorId) continue;
    rowsById.set(doctorId, {
      id: doctorId,
      auth_user_id: String((row as { auth_user_id?: string }).auth_user_id ?? ""),
    });
  }

  const seenAuth = new Set<string>();
  for (const row of rowsById.values()) {
    const doctorId = row.id;
    const authUserId = row.auth_user_id;
    if (authUserId) seenAuth.add(authUserId);
    if (doctorId) {
      await deleteTestDoctor({
        admin,
        doctorId,
        authUserId,
        email: normalized,
        password: "",
        slug: "",
      });
      if (authUserId) seenAuth.add(authUserId);
    }
  }

  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const user of data?.users ?? []) {
      if (String(user.email ?? "").trim().toLowerCase() !== normalized) continue;
      if (seenAuth.has(user.id)) continue;
      await admin.auth.admin.deleteUser(user.id);
    }
  } catch {
    // Listing auth users is best-effort; professional-row delete is the main path.
  }
}
