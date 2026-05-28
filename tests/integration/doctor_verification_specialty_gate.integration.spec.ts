import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test.describe("Integration: verify professional requires resolved specialty", () => {
  test("rejects verify when custom specialty is not approved", async ({ request }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const internalSecret = process.env.INTERNAL_DIRECTORY_SECRET ?? "";
    const safeEnv = process.env.INTEGRATION_SAFE_ENV === "1";

    const normalizeUrl = (u: string) => u.replace(/\/+$/, "");
    const prodSupabase = normalizeUrl(process.env.PROD_NEXT_PUBLIC_SUPABASE_URL ?? "");
    const integrationSupabase = normalizeUrl(supabaseUrl);
    const usingProductionSupabase =
      prodSupabase.length > 0 && integrationSupabase === prodSupabase;
    const unsafeBase = /mydoccy\.com/i.test(baseUrl);

    test.skip(
      !safeEnv || unsafeBase || usingProductionSupabase,
      "Unsafe target or missing INTEGRATION_SAFE_ENV.",
    );
    test.skip(
      !baseUrl || !supabaseUrl || !serviceRole || !internalSecret,
      "Missing integration env vars.",
    );

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const doctorEmail = `verify-gate-${nonce}@integration.test`;
    const doctorSlug = `verify-gate-${nonce}`;
    const cookieHeader = `doccy-internal-directory=${internalSecret}`;

    let authUserId = "";
    let doctorId = "";

    try {
      const created = await admin.auth.admin.createUser({
        email: doctorEmail,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (created.error || !created.data.user?.id) {
        throw new Error(`Failed creating auth user: ${created.error?.message}`);
      }
      authUserId = created.data.user.id;

      const insertDoctor = await admin
        .from("doctors")
        .insert({
          auth_user_id: authUserId,
          name: `Verify Gate ${nonce}`,
          specialty: "meditation",
          email: doctorEmail,
          phone: "+35799123456",
          languages: ["English"],
          license_number: `LIC-VG-${nonce}`,
          license_file_url: `licenses/integration/${nonce}-vg.pdf`,
          status: "pending",
          slug: doctorSlug,
          is_specialty_approved: false,
          subscription_tier: "standard",
        })
        .select("id")
        .single();
      if (insertDoctor.error || !insertDoctor.data?.id) {
        throw new Error(`Failed creating doctor: ${insertDoctor.error?.message}`);
      }
      doctorId = String(insertDoctor.data.id);

      const verifyRes = await request.post("/api/internal/doctors/verification", {
        headers: { Cookie: cookieHeader },
        data: { doctorId, action: "verify" },
      });
      expect(verifyRes.status()).toBe(400);

      const row = await admin
        .from("doctors")
        .select("status")
        .eq("id", doctorId)
        .single();
      expect(row.error).toBeNull();
      expect(row.data?.status).toBe("pending");

      const approve = await admin
        .from("doctors")
        .update({ is_specialty_approved: true })
        .eq("id", doctorId);
      expect(approve.error).toBeNull();

      const verifyOk = await request.post("/api/internal/doctors/verification", {
        headers: { Cookie: cookieHeader },
        data: { doctorId, action: "verify" },
      });
      expect(verifyOk.status()).toBe(200);

      const verified = await admin
        .from("doctors")
        .select("status")
        .eq("id", doctorId)
        .single();
      expect(verified.error).toBeNull();
      expect(verified.data?.status).toBe("verified");
    } finally {
      if (doctorId) {
        await admin.from("doctor_services").delete().eq("doctor_id", doctorId);
        await admin.from("doctor_settings").delete().eq("doctor_id", doctorId);
        await admin.from("doctors").delete().eq("id", doctorId);
      }
      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });
});
