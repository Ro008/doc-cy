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

  const { data: rows } = await admin
    .from("professionals")
    .select("id, auth_user_id")
    .ilike("email", normalized);

  const seenAuth = new Set<string>();
  for (const row of rows ?? []) {
    const doctorId = String((row as { id?: string }).id ?? "");
    const authUserId = String((row as { auth_user_id?: string }).auth_user_id ?? "");
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
