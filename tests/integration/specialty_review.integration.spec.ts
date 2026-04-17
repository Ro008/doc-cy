import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test.describe("Integration: internal specialty review endpoint", () => {
  test("supports map, approve_new and approve_edited", async ({ request }) => {
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
    const doctorEmail = `specialty-review-${nonce}@integration.test`;
    const doctorSlug = `specialty-review-${nonce}`;
    const cookieHeader = `doccy-internal-directory=${internalSecret}`;

    let authUserId = "";
    let doctorId = "";

    try {
      const createUserRes = await admin.auth.admin.createUser({
        email: doctorEmail,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (createUserRes.error || !createUserRes.data.user?.id) {
        throw new Error(
          `Failed creating integration auth user: ${createUserRes.error?.message}`,
        );
      }
      authUserId = createUserRes.data.user.id;

      const doctorInsert = await admin
        .from("doctors")
        .insert({
          auth_user_id: authUserId,
          name: `Specialty Review ${nonce}`,
          specialty: "acupuncture",
          email: doctorEmail,
          phone: "+35799123456",
          languages: ["English"],
          license_number: `LIC-SR-${nonce}`,
          license_file_url: `licenses/integration/${nonce}-sr.pdf`,
          status: "verified",
          slug: doctorSlug,
          is_specialty_approved: false,
          subscription_tier: "standard",
        })
        .select("id")
        .single();
      if (doctorInsert.error || !doctorInsert.data?.id) {
        throw new Error(`Failed creating integration doctor: ${doctorInsert.error?.message}`);
      }
      doctorId = String(doctorInsert.data.id);

      const mapRes = await request.post("/api/internal/doctors/specialty-review", {
        headers: { Cookie: cookieHeader },
        data: {
          doctorId,
          action: "map",
          mapTo: "Pediatrics",
        },
      });
      expect(mapRes.status()).toBe(200);

      let doctorRow = await admin
        .from("doctors")
        .select("specialty, is_specialty_approved")
        .eq("id", doctorId)
        .single();
      expect(doctorRow.error).toBeNull();
      expect(doctorRow.data?.specialty).toBe("Pediatrics");
      expect(doctorRow.data?.is_specialty_approved).toBe(true);

      const resetForApproveNew = await admin
        .from("doctors")
        .update({ specialty: "  acupuncture  ", is_specialty_approved: false })
        .eq("id", doctorId);
      expect(resetForApproveNew.error).toBeNull();

      const approveNewRes = await request.post("/api/internal/doctors/specialty-review", {
        headers: { Cookie: cookieHeader },
        data: {
          doctorId,
          action: "approve_new",
        },
      });
      expect(approveNewRes.status()).toBe(200);

      doctorRow = await admin
        .from("doctors")
        .select("specialty, is_specialty_approved")
        .eq("id", doctorId)
        .single();
      expect(doctorRow.error).toBeNull();
      expect(doctorRow.data?.specialty).toBe("acupuncture");
      expect(doctorRow.data?.is_specialty_approved).toBe(true);

      const resetForApproveEdited = await admin
        .from("doctors")
        .update({ specialty: "acupuncture", is_specialty_approved: false })
        .eq("id", doctorId);
      expect(resetForApproveEdited.error).toBeNull();

      const approveEditedRes = await request.post("/api/internal/doctors/specialty-review", {
        headers: { Cookie: cookieHeader },
        data: {
          doctorId,
          action: "approve_edited",
          editedSpecialty: " Acupuncture ",
        },
      });
      expect(approveEditedRes.status()).toBe(200);

      doctorRow = await admin
        .from("doctors")
        .select("specialty, is_specialty_approved")
        .eq("id", doctorId)
        .single();
      expect(doctorRow.error).toBeNull();
      expect(doctorRow.data?.specialty).toBe("Acupuncture");
      expect(doctorRow.data?.is_specialty_approved).toBe(true);

      const resetForReject = await admin
        .from("doctors")
        .update({ specialty: "acupuncture", is_specialty_approved: false })
        .eq("id", doctorId);
      expect(resetForReject.error).toBeNull();

      const rejectCanonicalRes = await request.post("/api/internal/doctors/specialty-review", {
        headers: { Cookie: cookieHeader },
        data: {
          doctorId,
          action: "approve_edited",
          editedSpecialty: "Pediatrics",
        },
      });
      expect(rejectCanonicalRes.status()).toBe(400);

      doctorRow = await admin
        .from("doctors")
        .select("specialty, is_specialty_approved")
        .eq("id", doctorId)
        .single();
      expect(doctorRow.error).toBeNull();
      expect(doctorRow.data?.specialty).toBe("acupuncture");
      expect(doctorRow.data?.is_specialty_approved).toBe(false);
    } finally {
      if (doctorId) {
        await admin.from("doctors").delete().eq("id", doctorId);
      }
      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });
});
