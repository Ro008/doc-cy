import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { DIRECTORY_CANARIES } from "../../lib/directory-canaries";
import { MAX_DOCTOR_LOCATIONS, sortDoctorLocations } from "../../lib/doctor-locations";
import { joinProfessionalClinic, leaveProfessionalClinic } from "../../lib/professional-clinics-server";
import { LEAVE_CLINIC_LOSES, leaveClinicNotes } from "../../lib/settings-leave-clinic";

/**
 * Settings → Clinics (user, 2026-10-11): she joins a clinic DocCy has and leaves one at
 * once, no founder; the database functions make the change and its record together.
 */

type Call = { fn: string; args: Record<string, unknown> };

function fakeService(result: { data?: unknown; error?: { code: string; message?: string } | null }) {
  const calls: Call[] = [];
  const service = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data: result.data ?? null, error: result.error ?? null };
    },
  } as unknown as SupabaseClient;
  return { service, calls };
}

const PRO = "11111111-1111-4111-8111-111111111111";
const CLINIC = "22222222-2222-4222-8222-222222222222";
const LINK = "33333333-3333-4333-8333-333333333333";

describe("joinProfessionalClinic", () => {
  it("joins through the database function and answers with her link", async () => {
    const { service, calls } = fakeService({ data: { request_id: "r", link_id: LINK, clinic_id: CLINIC } });
    const result = await joinProfessionalClinic(service, { professionalId: PRO, clinicId: CLINIC });
    assert.deepEqual(result, { ok: true, linkId: LINK });
    assert.deepEqual(calls, [
      { fn: "professional_clinic_join", args: { p_professional_id: PRO, p_clinic_id: CLINIC } },
    ]);
  });

  it("says so when the clinic is already hers", async () => {
    const { service } = fakeService({ error: { code: "23505" } });
    assert.deepEqual(await joinProfessionalClinic(service, { professionalId: PRO, clinicId: CLINIC }), {
      ok: false,
      status: 409,
      message: "You already work at this clinic.",
    });
  });

  it("says so when she has the most clinics allowed", async () => {
    const { service } = fakeService({ error: { code: "23514" } });
    const result = await joinProfessionalClinic(service, { professionalId: PRO, clinicId: CLINIC });
    assert.equal(result.ok === false && result.status, 409);
    assert.equal(
      result.ok === false && result.message,
      `You can have up to ${MAX_DOCTOR_LOCATIONS} clinics. Leave one to add another.`,
    );
  });

  it("does not find an unknown or archived clinic, nor something that is not an id", async () => {
    for (const code of ["P0002", "22P02"]) {
      const { service } = fakeService({ error: { code } });
      const result = await joinProfessionalClinic(service, { professionalId: PRO, clinicId: CLINIC });
      assert.equal(result.ok === false && result.status, 404, code);
    }
    const { service, calls } = fakeService({ data: null });
    const result = await joinProfessionalClinic(service, { professionalId: PRO, clinicId: "  " });
    assert.equal(result.ok === false && result.status, 404);
    assert.equal(calls.length, 0);
  });

  it("never joins a canary clinic", async () => {
    const canaryClinicId = DIRECTORY_CANARIES[0]!.clinicId;
    const { service, calls } = fakeService({ data: { link_id: LINK } });
    const result = await joinProfessionalClinic(service, { professionalId: PRO, clinicId: canaryClinicId });
    assert.equal(result.ok === false && result.status, 404);
    assert.equal(calls.length, 0);
  });

  it("fails plainly on anything else", async () => {
    const { service } = fakeService({ error: { code: "XX000", message: "boom" } });
    const result = await joinProfessionalClinic(service, { professionalId: PRO, clinicId: CLINIC });
    assert.equal(result.ok === false && result.status, 500);
    const odd = fakeService({ data: { nothing: true } });
    const oddResult = await joinProfessionalClinic(odd.service, { professionalId: PRO, clinicId: CLINIC });
    assert.equal(oddResult.ok === false && oddResult.status, 500);
  });
});

describe("leaveProfessionalClinic", () => {
  it("leaves through the database function, by her link to the clinic", async () => {
    const { service, calls } = fakeService({ data: "request-id" });
    assert.deepEqual(await leaveProfessionalClinic(service, { professionalId: PRO, linkId: LINK }), { ok: true });
    assert.deepEqual(calls, [
      { fn: "professional_clinic_leave", args: { p_professional_id: PRO, p_link_id: LINK } },
    ]);
  });

  it("keeps her last clinic, and says how to change clinic", async () => {
    const { service } = fakeService({ error: { code: "23514" } });
    assert.deepEqual(await leaveProfessionalClinic(service, { professionalId: PRO, linkId: LINK }), {
      ok: false,
      status: 409,
      message: "You need at least one clinic. To change clinic, add the new one first, then leave this one.",
    });
  });

  it("does not find a clinic that is not hers", async () => {
    for (const code of ["P0002", "22P02"]) {
      const { service } = fakeService({ error: { code } });
      const result = await leaveProfessionalClinic(service, { professionalId: PRO, linkId: LINK });
      assert.equal(result.ok === false && result.status, 404, code);
    }
  });
});

describe("the Leave clinic dialog", () => {
  it("says what she loses there", () => {
    assert.equal(
      LEAVE_CLINIC_LOSES,
      "Patients won’t find you at this clinic any more, and your hours, slot length and booking limits there are removed. The clinic itself stays in DocCy.",
    );
  });

  it("says nothing more when no visit is coming", () => {
    assert.deepEqual(leaveClinicNotes({ confirmed: 0, open: 0 }), []);
  });

  it("says confirmed visits stay", () => {
    assert.deepEqual(leaveClinicNotes({ confirmed: 1, open: 0 }), [
      "1 confirmed visit at this clinic stays in your agenda.",
    ]);
    assert.deepEqual(leaveClinicNotes({ confirmed: 3, open: 0 }), [
      "3 confirmed visits at this clinic stay in your agenda.",
    ]);
  });

  it("says open requests can only be accepted or declined afterwards", () => {
    assert.deepEqual(leaveClinicNotes({ confirmed: 0, open: 1 }), [
      "1 request at this clinic is waiting for your answer. After you leave, you can only accept or decline it. To suggest other times, do it before leaving.",
    ]);
    assert.deepEqual(leaveClinicNotes({ confirmed: 2, open: 4 }), [
      "2 confirmed visits at this clinic stay in your agenda.",
      "4 requests at this clinic are waiting for your answer. After you leave, you can only accept or decline them. To suggest other times, do it before leaving.",
    ]);
  });
});

describe("the order of her clinics", () => {
  it("is sort_order, then the date she joined: there is no primary clinic", () => {
    const rows = [
      { id: "late", sort_order: 1, created_at: "2026-03-01" },
      { id: "second", sort_order: 0, created_at: "2026-02-01" },
      { id: "first", sort_order: 0, created_at: "2026-01-01" },
    ];
    assert.deepEqual(
      sortDoctorLocations(rows).map((row) => row.id),
      ["first", "second", "late"],
    );
    // A leftover is_primary flag changes nothing.
    const flagged = [{ id: "a", sort_order: 1, is_primary: true }, { id: "b", sort_order: 0 }];
    assert.deepEqual(
      sortDoctorLocations(flagged).map((row) => row.id),
      ["b", "a"],
    );
  });
});
