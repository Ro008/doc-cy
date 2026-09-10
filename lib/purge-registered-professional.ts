import type { SupabaseClient } from "@supabase/supabase-js";

export type PurgeRegisteredProfessionalInput = {
  professionalId: string;
  /** Must match the professional's display name (trimmed, case-insensitive). */
  confirmName: string;
};

export type PurgeRegisteredProfessionalResult = {
  ok: true;
  professionalId: string;
  name: string;
  authUserId: string | null;
  warnings: string[];
};

export class PurgeRegisteredProfessionalError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PurgeRegisteredProfessionalError";
    this.status = status;
  }
}

type ProfessionalRow = {
  id: string;
  name: string | null;
  auth_user_id: string | null;
  is_registered: boolean | null;
  license_file_url: string | null;
  avatar_url: string | null;
  email: string | null;
  registration_email: string | null;
};

const CHILD_TABLES_BY_DOCTOR_ID = [
  "appointments",
  "doctor_specialty_change_requests",
  "doctor_specialties",
  "doctor_locations",
  "doctor_services",
  "doctor_settings",
  "doctor_monthly_digest_sent",
  "directory_duplicate_suggestions",
] as const;

const CHILD_TABLES_BY_PROFESSIONAL_ID = [
  "professional_clinics",
  "professional_patient_booking_requests",
  "professional_call_to_book_clicks",
  "professional_slug_redirects",
  "directory_duplicate_suggestions",
] as const;

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

async function deleteByEq(
  admin: SupabaseClient,
  table: string,
  column: string,
  id: string,
): Promise<string | null> {
  const { error } = await admin.from(table).delete().eq(column, id);
  if (error) return `${table}: ${error.message}`;
  return null;
}

async function listStorageFolderPaths(
  admin: SupabaseClient,
  bucket: string,
  folder: string,
): Promise<string[]> {
  const out: string[] = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(folder, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) break;
    const chunk = (data ?? [])
      .filter((f) => f.name && !f.name.endsWith("/"))
      .map((f) => `${folder}/${f.name}`);
    out.push(...chunk);
    if ((data ?? []).length < limit) break;
    offset += limit;
  }
  return out;
}

async function removeStoragePaths(
  admin: SupabaseClient,
  bucket: string,
  paths: string[],
  warnings: string[],
): Promise<void> {
  const unique = [...new Set(paths.map((p) => p.trim()).filter(Boolean))];
  if (unique.length === 0) return;
  const { error } = await admin.storage.from(bucket).remove(unique);
  if (error) {
    warnings.push(`${bucket} storage: ${error.message}`);
  }
}

/**
 * Permanently deletes a registered professional: related rows, Auth user, and
 * known storage objects (license proof + avatars). Irreversible.
 */
export async function purgeRegisteredProfessional(
  admin: SupabaseClient,
  input: PurgeRegisteredProfessionalInput,
): Promise<PurgeRegisteredProfessionalResult> {
  const professionalId = input.professionalId.trim();
  const confirmName = input.confirmName.trim();
  if (!professionalId) {
    throw new PurgeRegisteredProfessionalError("professionalId is required.", 400);
  }
  if (!confirmName) {
    throw new PurgeRegisteredProfessionalError(
      "Type the professional's name to confirm permanent deletion.",
      400,
    );
  }

  const { data: row, error: fetchErr } = await admin
    .from("professionals")
    .select(
      "id, name, auth_user_id, is_registered, license_file_url, avatar_url, email, registration_email",
    )
    .eq("id", professionalId)
    .maybeSingle();

  if (fetchErr) {
    throw new PurgeRegisteredProfessionalError(
      `Could not load professional: ${fetchErr.message}`,
      500,
    );
  }
  if (!row) {
    throw new PurgeRegisteredProfessionalError("Professional not found.", 404);
  }

  const pro = row as ProfessionalRow;
  if (pro.is_registered !== true) {
    throw new PurgeRegisteredProfessionalError(
      "Only registered professionals can be purged from this dashboard. Use directory tools for finder-only listings.",
      400,
    );
  }

  const name = String(pro.name ?? "").trim() || "Unknown";
  if (!namesMatch(name, confirmName)) {
    throw new PurgeRegisteredProfessionalError(
      "Confirmation name does not match. Type the exact professional name to delete.",
      400,
    );
  }

  const warnings: string[] = [];
  const authUserId = pro.auth_user_id ? String(pro.auth_user_id) : null;

  for (const table of CHILD_TABLES_BY_DOCTOR_ID) {
    const err = await deleteByEq(admin, table, "doctor_id", professionalId);
    if (err) warnings.push(err);
  }

  // directory_duplicate_suggestions may also key by professional_id / manual_id legacy.
  for (const table of CHILD_TABLES_BY_PROFESSIONAL_ID) {
    const err = await deleteByEq(admin, table, "professional_id", professionalId);
    if (err) warnings.push(err);
  }

  const { error: delProErr } = await admin
    .from("professionals")
    .delete()
    .eq("id", professionalId);
  if (delProErr) {
    throw new PurgeRegisteredProfessionalError(
      `Could not delete professional row: ${delProErr.message}`,
      500,
    );
  }

  if (authUserId) {
    const { error: authErr } = await admin.auth.admin.deleteUser(authUserId);
    if (
      authErr &&
      !String(authErr.message ?? "")
        .toLowerCase()
        .includes("not found")
    ) {
      warnings.push(`auth user: ${authErr.message}`);
    }
  }

  const licensePaths: string[] = [];
  if (pro.license_file_url) licensePaths.push(String(pro.license_file_url));
  await removeStoragePaths(admin, "doctor-verifications", licensePaths, warnings);

  const avatarPaths: string[] = [];
  if (pro.avatar_url) avatarPaths.push(String(pro.avatar_url));
  for (const folderId of [professionalId, authUserId].filter(Boolean) as string[]) {
    const listed = await listStorageFolderPaths(admin, "avatars", `profiles/${folderId}`);
    avatarPaths.push(...listed);
  }
  await removeStoragePaths(admin, "avatars", avatarPaths, warnings);

  return {
    ok: true,
    professionalId,
    name,
    authUserId,
    warnings,
  };
}
