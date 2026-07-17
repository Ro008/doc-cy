import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchAllSupabaseRows, SUPABASE_PAGE_SIZE } from "@/lib/supabase-fetch-all";

describe("fetchAllSupabaseRows", () => {
  it("paginates until a short page and returns all rows", async () => {
    const pages = [
      Array.from({ length: SUPABASE_PAGE_SIZE }, (_, i) => ({ id: i + 1 })),
      Array.from({ length: 3 }, (_, i) => ({ id: SUPABASE_PAGE_SIZE + i + 1 })),
    ];
    let calls = 0;

    const result = await fetchAllSupabaseRows<{ id: number }>(() => ({
      range: async (from, to) => {
        calls += 1;
        const page = pages[calls - 1] ?? [];
        assert.equal(to - from + 1, SUPABASE_PAGE_SIZE);
        return { data: page, error: null };
      },
    }));

    assert.equal(result.error, null);
    assert.equal(result.data?.length, SUPABASE_PAGE_SIZE + 3);
    assert.equal(calls, 2);
    assert.equal(result.data?.[0]?.id, 1);
    assert.equal(result.data?.at(-1)?.id, SUPABASE_PAGE_SIZE + 3);
  });

  it("returns the first-page error without inventing rows", async () => {
    const result = await fetchAllSupabaseRows<{ id: number }>(() => ({
      range: async () => ({ data: null, error: { message: "boom", code: "XX" } }),
    }));

    assert.equal(result.data, null);
    assert.equal(result.error?.message, "boom");
  });
});
