import type { SupabaseClient } from "@supabase/supabase-js";

export const TEST_LOGIN_PASSWORD_METADATA_KEY = "test_login_password";

/** Store plaintext login passwords only in local / non-production runtimes. */
export function shouldPersistLocalTestLoginPassword(): boolean {
  return (
    process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production"
  );
}

export function withLocalTestLoginPassword(
  metadata: Record<string, unknown>,
  password: string,
): Record<string, unknown> {
  return {
    ...metadata,
    [TEST_LOGIN_PASSWORD_METADATA_KEY]: password,
  };
}

export async function persistLocalTestLoginPassword(
  admin: SupabaseClient,
  authUserId: string,
  password: string,
  baseMetadata: Record<string, unknown> = {},
): Promise<void> {
  if (!shouldPersistLocalTestLoginPassword()) return;

  const { data } = await admin.auth.admin.getUserById(authUserId);
  const existing =
    data?.user?.user_metadata && typeof data.user.user_metadata === "object"
      ? (data.user.user_metadata as Record<string, unknown>)
      : {};

  await admin.auth.admin.updateUserById(authUserId, {
    user_metadata: withLocalTestLoginPassword({ ...existing, ...baseMetadata }, password),
  });
}

export async function loadLocalTestLoginPasswordsByAuthUserId(
  admin: SupabaseClient,
  authUserIds: string[],
): Promise<Map<string, string>> {
  const unique = Array.from(
    new Set(authUserIds.map((id) => id.trim()).filter(Boolean)),
  );
  const passwords = new Map<string, string>();
  if (unique.length === 0) return passwords;

  await Promise.all(
    unique.map(async (authUserId) => {
      const { data, error } = await admin.auth.admin.getUserById(authUserId);
      if (error || !data.user) return;

      const raw = data.user.user_metadata?.[TEST_LOGIN_PASSWORD_METADATA_KEY];
      if (typeof raw === "string" && raw.length > 0) {
        passwords.set(authUserId, raw);
      }
    }),
  );

  return passwords;
}
