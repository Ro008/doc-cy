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
  // Point E5: professional_clinics is the only link (professionals.clinic_id is dropped).
  it("counts professional_clinics links of active professionals only", async () => {
    const client = makeClient({
      professional_clinics: [
        { clinic_id: "c1", professional_id: "p1" },
        { clinic_id: "c1", professional_id: "p2" },
        { clinic_id: "c2", professional_id: "p3" },
        { clinic_id: "c3", professional_id: "archived" },
      ],
      professionals: [
        { id: "p1" },
        { id: "p2" },
        { id: "p3" },
        // A leftover clinic_id on the row is not a link.
        { id: "p4", clinic_id: "c2" },
      ],
    });

    const { data, error } = await loadClinicProfessionalCountById(client);
    assert.equal(error, null);
    assert.equal(data.get("c1"), 2);
    assert.equal(data.get("c2"), 1);
    assert.equal(data.has("c3"), false);
  });
});
