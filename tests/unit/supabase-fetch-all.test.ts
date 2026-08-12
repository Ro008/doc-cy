import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chunkArray,
  fetchAllSupabaseRows,
  fetchAllSupabaseRowsForIdChunks,
  SUPABASE_IN_FILTER_CHUNK,
  SUPABASE_PAGE_SIZE,
} from "@/lib/supabase-fetch-all";

describe("fetchAllSupabaseRows", () => {
  it("documents the PostgREST page size we must page past", () => {
    // Server max-rows is ~1000; raising .limit() above this does nothing.
    assert.equal(SUPABASE_PAGE_SIZE, 1000);
    assert.ok(SUPABASE_IN_FILTER_CHUNK > 0);
    assert.ok(SUPABASE_IN_FILTER_CHUNK < SUPABASE_PAGE_SIZE);
  });

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

  it("continues after an exact full page then stops on an empty page", async () => {
    let calls = 0;
    const result = await fetchAllSupabaseRows<{ id: number }>(() => ({
      range: async () => {
        calls += 1;
        if (calls === 1) {
          return {
            data: Array.from({ length: SUPABASE_PAGE_SIZE }, (_, i) => ({ id: i + 1 })),
            error: null,
          };
        }
        return { data: [], error: null };
      },
    }));

    assert.equal(result.error, null);
    assert.equal(result.data?.length, SUPABASE_PAGE_SIZE);
    assert.equal(calls, 2);
  });

  it("returns the first-page error without inventing rows", async () => {
    const result = await fetchAllSupabaseRows<{ id: number }>(() => ({
      range: async () => ({ data: null, error: { message: "boom", code: "XX" } }),
    }));

    assert.equal(result.data, null);
    assert.equal(result.error?.message, "boom");
  });

  it("keeps earlier pages when a later page errors", async () => {
    let calls = 0;
    const result = await fetchAllSupabaseRows<{ id: number }>(() => ({
      range: async () => {
        calls += 1;
        if (calls === 1) {
          return {
            data: Array.from({ length: SUPABASE_PAGE_SIZE }, (_, i) => ({ id: i + 1 })),
            error: null,
          };
        }
        return { data: null, error: { message: "page-2-failed", code: "XX" } };
      },
    }));

    assert.equal(result.error?.message, "page-2-failed");
    assert.equal(result.data?.length, SUPABASE_PAGE_SIZE);
  });
});

describe("chunkArray + fetchAllSupabaseRowsForIdChunks", () => {
  it("splits ids into fixed-size chunks", () => {
    assert.deepEqual(chunkArray([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(chunkArray([], 2), []);
  });

  it("pages across multiple id chunks", async () => {
    const seenChunks: string[][] = [];
    const result = await fetchAllSupabaseRowsForIdChunks<{ id: string }>(
      ["a", "b", "c"],
      (idChunk) => {
        seenChunks.push([...idChunk]);
        return {
          range: async () => ({
            data: idChunk.map((id) => ({ id })),
            error: null,
          }),
        };
      },
      { idChunkSize: 2 },
    );

    assert.equal(result.error, null);
    assert.deepEqual(seenChunks, [["a", "b"], ["c"]]);
    assert.deepEqual(result.data, [{ id: "a" }, { id: "b" }, { id: "c" }]);
  });

  it("returns earlier chunk rows when a later chunk errors", async () => {
    const result = await fetchAllSupabaseRowsForIdChunks<{ id: string }>(
      ["a", "b", "c"],
      (idChunk) => ({
        range: async () => {
          if (idChunk.includes("c")) {
            return { data: null, error: { message: "chunk-failed", code: "XX" } };
          }
          return { data: idChunk.map((id) => ({ id })), error: null };
        },
      }),
      { idChunkSize: 2 },
    );

    assert.equal(result.error?.message, "chunk-failed");
    assert.deepEqual(result.data, [{ id: "a" }, { id: "b" }]);
  });
});
