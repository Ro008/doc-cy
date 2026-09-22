import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  deleteProfessionalSpecialty,
  sameSpecialtySlug,
  upsertProfessionalSpecialty,
  type ProfessionalSpecialtyRow,
} from "@/lib/professional-specialty-writes";

type Call = { op: string; values?: unknown; filter?: [string, unknown] };

/** Minimal stand-in for the `professional_specialties` query builder. */
function fakeClient(rows: ProfessionalSpecialtyRow[]) {
  const calls: Call[] = [];
  const builder = (table: string) => {
    assert.equal(table, "professional_specialties");
    let op = "select";
    let values: unknown;
    const chain = {
      select: () => chain,
      order: () => Promise.resolve({ data: rows, error: null }),
      eq: (column: string, value: unknown) => {
        if (op === "select") return chain;
        calls.push({ op, values, filter: [column, value] });
        return Promise.resolve({ error: null });
      },
      in: (column: string, value: unknown) => {
        calls.push({ op, values, filter: [column, value] });
        return Promise.resolve({ error: null });
      },
      update: (v: unknown) => {
        op = "update";
        values = v;
        return chain;
      },
      delete: () => {
        op = "delete";
        return chain;
      },
      insert: (v: unknown) => {
        calls.push({ op: "insert", values: v });
        return Promise.resolve({ error: null });
      },
    };
    return chain;
  };
  return { client: { from: builder } as unknown as SupabaseClient, calls };
}

const row = (id: string, specialty: string, isApproved = true): ProfessionalSpecialtyRow => ({
  id,
  professional_id: "p1",
  specialty,
  license_number: "L",
  is_approved: isApproved,
});

describe("professional specialty writes", () => {
  it("compares labels by slug", () => {
    assert.equal(sameSpecialtySlug("Sound Healing", "sound-healing"), true);
    assert.equal(sameSpecialtySlug("Cardiology", "Dermatology"), false);
  });

  it("updates the row with the same slug instead of inserting a clashing one", async () => {
    const { client, calls } = fakeClient([row("r1", "cardiology", false)]);
    const { error } = await upsertProfessionalSpecialty(client, {
      professionalId: "p1",
      specialty: "Cardiology",
      licenseNumber: "NEW",
      isApproved: true,
    });
    assert.equal(error, null);
    assert.deepEqual(calls, [
      {
        op: "update",
        values: { specialty: "Cardiology", license_number: "NEW", is_approved: true },
        filter: ["id", "r1"],
      },
    ]);
  });

  it("inserts a new specialty", async () => {
    const { client, calls } = fakeClient([row("r1", "Cardiology")]);
    await upsertProfessionalSpecialty(client, {
      professionalId: "p1",
      specialty: "Dermatology",
      licenseNumber: "L2",
      isApproved: true,
    });
    assert.deepEqual(calls, [
      {
        op: "insert",
        values: {
          professional_id: "p1",
          specialty: "Dermatology",
          license_number: "L2",
          is_approved: true,
        },
      },
    ]);
  });

  it("deletes by slug, not by pattern (underscores are literal)", async () => {
    const { client, calls } = fakeClient([
      row("r1", "Sports_Medicine"),
      row("r2", "SportsXMedicine"),
    ]);
    await deleteProfessionalSpecialty(client, "p1", "Sports_Medicine");
    assert.deepEqual(calls, [{ op: "delete", values: undefined, filter: ["id", ["r1"]] }]);
  });

  it("does nothing when no row matches", async () => {
    const { client, calls } = fakeClient([row("r1", "Cardiology")]);
    const { error } = await deleteProfessionalSpecialty(client, "p1", "Dermatology");
    assert.equal(error, null);
    assert.deepEqual(calls, []);
  });
});
