import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ADMIN_MFA_MAX_AGE_SECONDS,
  decideAdminWriteAccess,
  resolveAdminAccess,
  supabaseAdminAccessDeps,
} from "../../lib/admin-auth-core";
import { totpCode } from "../../scripts/lib/totp.mjs";

/**
 * Admin access against real Supabase Auth: a throwaway login signs in with a
 * password (aal1), enrols a TOTP factor and verifies a code (aal2). Proves the
 * token really carries a timestamped `totp` amr entry, which the 7-day rule needs.
 * API only (no page); cleans up its login and admin row.
 */

function normalizeUrl(u: string): string {
  return u.replace(/\/+$/, "");
}

function unsafeTargetReason(supabaseUrl: string): string | null {
  const prodSupabase = normalizeUrl(process.env.PROD_NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (process.env.INTEGRATION_SAFE_ENV !== "1") return "Missing INTEGRATION_SAFE_ENV.";
  if (/oiwlztcduxojadbcxkil/.test(supabaseUrl)) return "Refusing to run against Production.";
  if (prodSupabase && normalizeUrl(supabaseUrl) === prodSupabase) {
    return "Refusing to run against Production.";
  }
  return null;
}

test.describe("Admin access (Supabase MFA)", { tag: ["@pr-e2e"] }, () => {
  test("admin needs an active row and a verified TOTP code", async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const unsafe = unsafeTargetReason(supabaseUrl);
    test.skip(Boolean(unsafe), unsafe ?? undefined);
    test.skip(!supabaseUrl || !anonKey || !serviceKey, "Missing integration env vars.");

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const user: SupabaseClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const access = () => resolveAdminAccess(supabaseAdminAccessDeps(user, service));

    const tag = randomUUID().slice(0, 8);
    const email = `admin-access-${tag}@integration.test`;
    const password = `Adm1n-${randomUUID()}`;
    let authUserId: string | null = null;

    try {
      const created = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      authUserId = created.data.user!.id;

      expect(await access()).toEqual({ ok: false, reason: "signed_out" });

      const signIn = await user.auth.signInWithPassword({ email, password });
      expect(signIn.error).toBeNull();

      // Signed in, but not an admin yet.
      expect(await access()).toEqual({ ok: false, reason: "not_admin" });

      const inserted = await service
        .from("admin_users")
        .insert({ auth_user_id: authUserId, name: `Admin Access ${tag}`, email })
        .select("id")
        .single();
      expect(inserted.error).toBeNull();

      // Admin row, password only: 2FA still required.
      expect(await access()).toEqual({ ok: false, reason: "mfa_required" });

      // Even a signed-in admin can't read the table with their own session.
      const ownRead = await user.from("admin_users").select("id").limit(1);
      expect(ownRead.error?.code).toBe("42501");

      const enrolled = await user.auth.mfa.enroll({ factorType: "totp" });
      expect(enrolled.error).toBeNull();
      const factorId = enrolled.data!.id;
      const secret = enrolled.data!.totp.secret;

      const verified = await user.auth.mfa.challengeAndVerify({
        factorId,
        code: totpCode(secret),
      });
      expect(verified.error).toBeNull();

      const granted = await access();
      expect(granted.ok).toBe(true);
      if (!("reason" in granted)) {
        expect(granted.admin.email).toBe(email);
        expect(granted.admin.role).toBe("founder");
        const now = Math.floor(Date.now() / 1000);
        expect(Math.abs(now - granted.mfaVerifiedAt)).toBeLessThan(120);
        expect(ADMIN_MFA_MAX_AGE_SECONDS).toBe(7 * 24 * 60 * 60);
      }

      // A founder may change data; a partner may only read.
      expect(decideAdminWriteAccess(await access()).ok).toBe(true);
      const toPartner = await service
        .from("admin_users")
        .update({ role: "partner" })
        .eq("auth_user_id", authUserId);
      expect(toPartner.error).toBeNull();
      expect((await access()).ok).toBe(true);
      expect(decideAdminWriteAccess(await access())).toEqual({ ok: false, reason: "read_only" });

      // Deactivated admins lose access at once, even with a valid 2FA session.
      const deactivated = await service
        .from("admin_users")
        .update({ is_active: false })
        .eq("auth_user_id", authUserId);
      expect(deactivated.error).toBeNull();
      expect(await access()).toEqual({ ok: false, reason: "inactive" });
    } finally {
      if (authUserId) {
        await service.from("admin_users").delete().eq("auth_user_id", authUserId);
        await service.auth.admin.deleteUser(authUserId);
      }
    }
  });
});
