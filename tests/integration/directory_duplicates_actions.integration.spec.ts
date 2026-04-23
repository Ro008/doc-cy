import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function normalizeUrl(u: string): string {
  return u.replace(/\/+$/, "");
}

test.describe("Integration: internal directory duplicate actions", () => {
  test("merge archives manual and dismiss updates suggestion status", async ({ request }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const internalSecret = process.env.INTERNAL_DIRECTORY_SECRET ?? "";
    const safeEnv = process.env.INTEGRATION_SAFE_ENV === "1";

    const prodSupabase = normalizeUrl(process.env.PROD_NEXT_PUBLIC_SUPABASE_URL ?? "");
    const integrationSupabase = normalizeUrl(supabaseUrl);
    const usingProductionSupabase =
      prodSupabase.length > 0 && integrationSupabase === prodSupabase;
    const unsafeBase = /mydoccy\.com/i.test(baseUrl);

    test.skip(
      !safeEnv || unsafeBase || usingProductionSupabase,
      "Unsafe target or missing INTEGRATION_SAFE_ENV."
    );
    test.skip(
      !baseUrl || !supabaseUrl || !serviceRole || !internalSecret,
      "Missing integration env vars."
    );

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const cookieHeader = `doccy-internal-directory=${internalSecret}`;

    let authUserA = "";
    let authUserB = "";
    let doctorA = "";
    let doctorB = "";
    let manualA = "";
    let manualB = "";
    let suggestionMerge = "";
    let suggestionSibling = "";
    let suggestionDismiss = "";

    try {
      const createUserA = await admin.auth.admin.createUser({
        email: `dup-a-${nonce}@integration.test`,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      const createUserB = await admin.auth.admin.createUser({
        email: `dup-b-${nonce}@integration.test`,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (createUserA.error || !createUserA.data.user?.id) {
        throw new Error(`Failed creating user A: ${createUserA.error?.message}`);
      }
      if (createUserB.error || !createUserB.data.user?.id) {
        throw new Error(`Failed creating user B: ${createUserB.error?.message}`);
      }
      authUserA = createUserA.data.user.id;
      authUserB = createUserB.data.user.id;

      const insertDoctors = await admin
        .from("doctors")
        .insert([
          {
            auth_user_id: authUserA,
            name: `Dup Doctor A ${nonce}`,
            specialty: "Dentistry",
            district: "Paphos",
            email: `dup-a-${nonce}@integration.test`,
            phone: "+35799111111",
            languages: ["English"],
            license_number: `LIC-DUP-A-${nonce}`,
            license_file_url: `licenses/integration/${nonce}-dup-a.pdf`,
            status: "verified",
            slug: `dup-doctor-a-${nonce}`,
            is_specialty_approved: true,
            subscription_tier: "standard",
          },
          {
            auth_user_id: authUserB,
            name: `Dup Doctor B ${nonce}`,
            specialty: "Dentistry",
            district: "Paphos",
            email: `dup-b-${nonce}@integration.test`,
            phone: "+35799222222",
            languages: ["Greek"],
            license_number: `LIC-DUP-B-${nonce}`,
            license_file_url: `licenses/integration/${nonce}-dup-b.pdf`,
            status: "verified",
            slug: `dup-doctor-b-${nonce}`,
            is_specialty_approved: true,
            subscription_tier: "standard",
          },
        ])
        .select("id, slug");

      if (insertDoctors.error || !insertDoctors.data || insertDoctors.data.length !== 2) {
        throw new Error(`Failed creating doctors: ${insertDoctors.error?.message}`);
      }
      doctorA = String(insertDoctors.data[0].id);
      doctorB = String(insertDoctors.data[1].id);

      const insertManual = await admin
        .from("directory_manual")
        .insert([
          {
            name: `Manual Match ${nonce}`,
            specialty: "Dentistry",
            district: "Paphos",
            address_maps_link: "https://maps.google.com/?q=Paphos",
            is_archived: false,
          },
          {
            name: `Manual Dismiss ${nonce}`,
            specialty: "Dentistry",
            district: "Paphos",
            address_maps_link: "https://maps.google.com/?q=Paphos",
            is_archived: false,
          },
        ])
        .select("id, name");
      if (insertManual.error || !insertManual.data || insertManual.data.length !== 2) {
        throw new Error(`Failed creating manual rows: ${insertManual.error?.message}`);
      }
      manualA = String(insertManual.data[0].id);
      manualB = String(insertManual.data[1].id);

      const insertSuggestions = await admin
        .from("directory_duplicate_suggestions")
        .insert([
          {
            manual_id: manualA,
            doctor_id: doctorA,
            score: 0.94,
            reason: "name+specialty+district",
            status: "pending",
          },
          {
            manual_id: manualA,
            doctor_id: doctorB,
            score: 0.81,
            reason: "same district",
            status: "pending",
          },
          {
            manual_id: manualB,
            doctor_id: doctorB,
            score: 0.71,
            reason: "same specialty",
            status: "pending",
          },
        ])
        .select("id, manual_id");

      if (insertSuggestions.error || !insertSuggestions.data || insertSuggestions.data.length !== 3) {
        throw new Error(`Failed creating suggestions: ${insertSuggestions.error?.message}`);
      }
      suggestionMerge = String(insertSuggestions.data[0].id);
      suggestionSibling = String(insertSuggestions.data[1].id);
      suggestionDismiss = String(insertSuggestions.data[2].id);

      const mergeRes = await request.post("/api/internal/directory-duplicates/merge", {
        headers: { Cookie: cookieHeader },
        data: { suggestionId: suggestionMerge },
      });
      expect(mergeRes.status()).toBe(200);

      const manualAState = await admin
        .from("directory_manual")
        .select("is_archived")
        .eq("id", manualA)
        .single();
      expect(manualAState.error).toBeNull();
      expect(manualAState.data?.is_archived).toBe(true);

      const mergedState = await admin
        .from("directory_duplicate_suggestions")
        .select("status")
        .eq("id", suggestionMerge)
        .single();
      expect(mergedState.error).toBeNull();
      expect(mergedState.data?.status).toBe("merged");

      const siblingState = await admin
        .from("directory_duplicate_suggestions")
        .select("status")
        .eq("id", suggestionSibling)
        .single();
      expect(siblingState.error).toBeNull();
      expect(siblingState.data?.status).toBe("dismissed");

      const dismissRes = await request.post("/api/internal/directory-duplicates/dismiss", {
        headers: { Cookie: cookieHeader },
        data: { suggestionId: suggestionDismiss },
      });
      expect(dismissRes.status()).toBe(200);

      const dismissedState = await admin
        .from("directory_duplicate_suggestions")
        .select("status, resolved_at")
        .eq("id", suggestionDismiss)
        .single();
      expect(dismissedState.error).toBeNull();
      expect(dismissedState.data?.status).toBe("dismissed");
      expect(Boolean(dismissedState.data?.resolved_at)).toBe(true);
    } finally {
      if (manualA) await admin.from("directory_manual").delete().eq("id", manualA);
      if (manualB) await admin.from("directory_manual").delete().eq("id", manualB);
      if (doctorA) await admin.from("doctors").delete().eq("id", doctorA);
      if (doctorB) await admin.from("doctors").delete().eq("id", doctorB);
      if (authUserA) await admin.auth.admin.deleteUser(authUserA);
      if (authUserB) await admin.auth.admin.deleteUser(authUserB);
    }
  });
});

