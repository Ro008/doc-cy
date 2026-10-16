import { expect, test, type APIRequestContext } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { issueAppointmentLink } from "@/lib/appointment-links-db";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  adminCookieHeader,
  createTestAdmin,
  deleteTestAdmin,
  sharedTestFounder,
  type TestAdmin,
} from "./helpers/test-admin";
import {
  createTestDoctor,
  deleteTestClinics,
  deleteTestDoctor,
  openPrimaryClinicForBookings,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

/**
 * Reviews wait for the founders (user, 2026-10-15): the patient's review is stored as
 * pending and the patient is told it will be checked and published soon. In the internal
 * dashboard (Requests tab) a founder approves it (published: profile + finder) or rejects
 * it (final; nobody is told). Partners only see. No emails either way.
 */
const DAY = 24 * 60 * 60 * 1000;

test.describe("Integration: review moderation", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  let partner: TestAdmin | null = null;
  const clinicIds: string[] = [];
  const nonce = `mod${Date.now()}`.slice(-12);

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Moderation ${nonce}`, specialty: "Cardiology" });
    const seeded = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicIds.push(seeded.clinicId);
  });

  test.afterAll(async () => {
    if (partner) await deleteTestAdmin(partner);
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, clinicIds);
  });

  /** A past, attended visit and the patient's review sent from its link. */
  async function sentReview(request: APIRequestContext, tag: string, comment: string) {
    const email = `moderation-${tag}-${nonce}@integration.test`;
    const { data, error } = await admin
      .from("appointments")
      .insert({
        professional_id: pro!.doctorId,
        clinic_id: clinicIds[0],
        booking_source: "online",
        patient_name: `Maria ${tag} Kyriakou`,
        patient_email: email,
        patient_phone: "+35799555666",
        patient_gender: "female",
        patient_birthdate: "1990-02-02",
        is_new_patient: true,
        reason: "Integration: review moderation",
        appointment_datetime: new Date(Date.now() - 2 * DAY).toISOString(),
        duration_minutes: 30,
        status: "CONFIRMED",
        attendance: "attended",
        review_requested_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`seed: ${error?.message}`);
    const token = await issueAppointmentLink(admin, {
      appointmentId: String(data.id),
      purpose: "review",
      expiresAt: new Date(Date.now() + 30 * DAY),
    });
    const res = await request.post("/api/booking/review", { data: { token, rating: 4, comment, email } });
    expect(res.status(), await res.text()).toBe(200);
    const { data: review } = await admin
      .from("professional_reviews")
      .select("id, status, moderated_at, moderated_by")
      .eq("appointment_id", String(data.id))
      .single();
    return review as { id: string; status: string; moderated_at: string | null; moderated_by: string | null };
  }

  const stored = async (id: string) =>
    (
      await admin
        .from("professional_reviews")
        .select("status, moderated_at, moderated_by")
        .eq("id", id)
        .single()
    ).data as { status: string; moderated_at: string | null; moderated_by: string | null };

  test("a new review waits, and the founders see it in Requests", async ({ request }) => {
    const review = await sentReview(request, "wait", `Waiting review ${nonce}`);
    expect(review).toMatchObject({ status: "pending", moderated_at: null, moderated_by: null });

    const founder = await sharedTestFounder();
    const page = await request.get("/internal/directory?tab=requests", {
      headers: { Cookie: adminCookieHeader(founder) },
    });
    expect(page.status()).toBe(200);
    const html = await page.text();
    expect(html).toContain('data-testid="review-moderation"');
    expect(html).toContain(`data-review-id="${review.id}"`);
    expect(html).toContain(`Waiting review ${nonce}`);
  });

  test("a founder approves: published, with who and when", async ({ request }) => {
    const review = await sentReview(request, "ok", "Kind and thorough.");
    const founder = await sharedTestFounder();
    const res = await request.post(`/api/internal/reviews/${review.id}/approve`, {
      headers: { Cookie: adminCookieHeader(founder) },
    });
    expect(res.status(), await res.text()).toBe(200);
    expect(await res.json()).toEqual({ status: "published" });
    const after = await stored(review.id);
    expect(after.status).toBe("published");
    expect(after.moderated_by).toBe(founder.adminId);
    expect(after.moderated_at).not.toBeNull();
  });

  test("a founder rejects: final, a second decision is refused", async ({ request }) => {
    const review = await sentReview(request, "no", "Buy my supplements at example.com");
    const headers = { Cookie: adminCookieHeader(await sharedTestFounder()) };
    const res = await request.post(`/api/internal/reviews/${review.id}/reject`, { headers });
    expect(res.status(), await res.text()).toBe(200);
    expect(await res.json()).toEqual({ status: "rejected" });
    expect((await stored(review.id)).status).toBe("rejected");

    const again = await request.post(`/api/internal/reviews/${review.id}/approve`, { headers });
    expect(again.status()).toBe(409);
    expect((await stored(review.id)).status).toBe("rejected");
  });

  test("partners and signed-out visitors can't decide; an unknown review is a 404", async ({ request }) => {
    const review = await sentReview(request, "guard", "Very good.");
    expect((await request.post(`/api/internal/reviews/${review.id}/approve`)).status()).toBe(401);

    partner = await createTestAdmin({ role: "partner", withTotp: true });
    const partnerRes = await request.post(`/api/internal/reviews/${review.id}/approve`, {
      headers: { Cookie: adminCookieHeader(partner) },
    });
    expect(partnerRes.status()).toBe(403);
    expect((await stored(review.id)).status).toBe("pending");

    const headers = { Cookie: adminCookieHeader(await sharedTestFounder()) };
    const missing = await request.post(`/api/internal/reviews/00000000-0000-4000-8000-000000000000/reject`, { headers });
    expect(missing.status()).toBe(404);
    const notUuid = await request.post(`/api/internal/reviews/not-a-uuid/reject`, { headers });
    expect(notUuid.status()).toBe(404);
  });
});
