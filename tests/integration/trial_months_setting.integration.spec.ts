import { expect, test } from "@playwright/test";

import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  adminCookieHeader,
  createTestAdmin,
  deleteTestAdmin,
  sharedTestFounder,
  type TestAdmin,
} from "./helpers/test-admin";

/**
 * The free-trial length (whole months) is a setting founders change in the internal
 * dashboard (`app_settings.trial_months`), not an env var. Partners can see it but not
 * change it; nobody else can see it. Approving a registration will use it for
 * `pro_access_until` (a founder can override it for one approval, in step 4).
 */

const PATH = "/api/internal/settings/trial-months";

test.describe("Internal setting: trial months", { tag: "@pr-e2e" }, () => {
  test("founders read and change it, partners only read, others are refused", async ({
    request,
  }) => {
    test.setTimeout(120_000);
    const service = createIntegrationAdmin(requireSafeIntegration());

    const before = await service
      .from("app_settings")
      .select("value")
      .eq("key", "trial_months")
      .single();
    expect(before.error).toBeNull();
    const original = before.data?.value;

    let partner: TestAdmin | null = null;
    try {
      // Signed out: refused.
      expect((await request.get(PATH)).status()).toBe(401);
      expect((await request.patch(PATH, { data: { months: 7 } })).status()).toBe(401);

      const founder = await sharedTestFounder();
      const founderHeaders = { Cookie: adminCookieHeader(founder) };

      const read = await request.get(PATH, { headers: founderHeaders });
      expect(read.status()).toBe(200);
      expect((await read.json()).months).toBe(Number(original));

      // A founder changes it; the change records who made it.
      const changed = await request.patch(PATH, { headers: founderHeaders, data: { months: 7 } });
      expect(changed.status(), await changed.text()).toBe(200);
      expect((await changed.json()).months).toBe(7);
      const stored = await service
        .from("app_settings")
        .select("value, updated_by")
        .eq("key", "trial_months")
        .single();
      expect(Number(stored.data?.value)).toBe(7);
      expect(stored.data?.updated_by).toBe(founder.adminId);

      // The dashboard shows it.
      const dashboard = await request.get("/internal/directory", { headers: founderHeaders });
      expect(dashboard.status()).toBe(200);
      expect(await dashboard.text()).toMatch(/Free trial:\s*(<!-- -->)?\s*7\s*(<!-- -->)?\s*months/);

      // Invalid values are refused and change nothing.
      for (const bad of [25, -1, 1.5, "six"]) {
        const res = await request.patch(PATH, { headers: founderHeaders, data: { months: bad } });
        expect(res.status(), `months=${String(bad)}`).toBe(400);
      }

      // A partner can read it but not change it.
      partner = await createTestAdmin({ role: "partner", withTotp: true });
      const partnerHeaders = { Cookie: adminCookieHeader(partner) };
      const partnerRead = await request.get(PATH, { headers: partnerHeaders });
      expect(partnerRead.status()).toBe(200);
      expect((await partnerRead.json()).months).toBe(7);
      const partnerWrite = await request.patch(PATH, { headers: partnerHeaders, data: { months: 3 } });
      expect(partnerWrite.status()).toBe(403);

      const after = await service
        .from("app_settings")
        .select("value")
        .eq("key", "trial_months")
        .single();
      expect(Number(after.data?.value)).toBe(7);
    } finally {
      // Put the shared setting back, and drop the reference to the test founder so
      // its admin row can be cleaned up.
      await service
        .from("app_settings")
        .update({ value: original ?? 6, updated_by: null })
        .eq("key", "trial_months");
      await deleteTestAdmin(partner, service);
    }
  });
});
