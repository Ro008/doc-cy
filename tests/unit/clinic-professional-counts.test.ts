import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadClinicProfessionalCountById } from "@/lib/clinic-professional-counts";

type Row = Record<string, unknown>;

function makeClient(tables: { professional_clinics: Row[]; professionals: Row[] }) {
  return {
    from(table: string) {
      const rows = tables[table as keyof typeof tables] ?? [];
      const withRange = {
        range: async () => ({ data: rows, error: null }),
        eq: () => withRange,
      };
      return {
        select: () => withRange,
      };
    },
  } as unknown as SupabaseClient;
}

describe("loadClinicProfessionalCountById", () => {
  it("merges N:M links with legacy clinic_id and ignores archived professionals", async () => {
    const client = makeClient({
      professional_clinics: [
        { clinic_id: "c1", professional_id: "p1" },
        { clinic_id: "c1", professional_id: "p2" },
        { clinic_id: "c2", professional_id: "p3" },
        { clinic_id: "c3", professional_id: "archived" },
      ],
      professionals: [
        { id: "p1", clinic_id: null },
        { id: "p2", clinic_id: "c1" },
        { id: "p3", clinic_id: null },
        { id: "p4", clinic_id: "c2" },
      ],
    });

    const { data, error } = await loadClinicProfessionalCountById(client);
    assert.equal(error, null);
    assert.equal(data.get("c1"), 2);
    assert.equal(data.get("c2"), 2);
    assert.equal(data.has("c3"), false);
  });
});
