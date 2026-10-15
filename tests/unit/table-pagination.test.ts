import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { TABLE_PAGE_SIZE, paginate } from "../../lib/table-pagination";

/**
 * The tables in the founder dashboard's Statistics tab show 10 rows at a time (user,
 * 2026-10-15). The rows are already loaded; this only decides which ones show.
 */

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");
const rows = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("paginate", () => {
  it("shows 10 rows a page by default", () => {
    assert.equal(TABLE_PAGE_SIZE, 10);
    const first = paginate(rows(34), 1);
    assert.deepEqual(first.rows, rows(10));
    assert.deepEqual(
      { page: first.page, pageCount: first.pageCount, total: first.total, from: first.from, to: first.to },
      { page: 1, pageCount: 4, total: 34, from: 1, to: 10 },
    );
  });

  it("gives the middle and the last (partial) page", () => {
    const second = paginate(rows(34), 2);
    assert.deepEqual(second.rows, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    assert.equal(second.from, 11);
    assert.equal(second.to, 20);
    const last = paginate(rows(34), 4);
    assert.deepEqual(last.rows, [31, 32, 33, 34]);
    assert.equal(last.from, 31);
    assert.equal(last.to, 34);
  });

  it("has no extra empty page when the rows fill the pages exactly", () => {
    const exact = paginate(rows(20), 2);
    assert.equal(exact.pageCount, 2);
    assert.deepEqual(exact.rows, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it("is one page when there are 10 rows or fewer, or none", () => {
    assert.equal(paginate(rows(10), 1).pageCount, 1);
    assert.equal(paginate(rows(3), 1).pageCount, 1);
    const empty = paginate([], 1);
    assert.deepEqual(
      { rows: empty.rows, page: empty.page, pageCount: empty.pageCount, total: empty.total, from: empty.from, to: empty.to },
      { rows: [], page: 1, pageCount: 1, total: 0, from: 0, to: 0 },
    );
  });

  it("brings an out-of-range or invalid page back into range", () => {
    assert.equal(paginate(rows(34), 99).page, 4);
    assert.equal(paginate(rows(34), 0).page, 1);
    assert.equal(paginate(rows(34), -3).page, 1);
    assert.equal(paginate(rows(34), Number.NaN).page, 1);
    assert.equal(paginate(rows(34), 2.7).page, 2);
  });

  it("takes another page size", () => {
    const small = paginate(rows(7), 3, 3);
    assert.deepEqual(small.rows, [7]);
    assert.equal(small.pageCount, 3);
  });

  it("doesn't change the rows it was given", () => {
    const original = rows(15);
    paginate(original, 2);
    assert.deepEqual(original, rows(15));
  });
});

describe("the Statistics tables use it", () => {
  const tables: Array<[string, string]> = [
    ["components/internal/ManualPatientVotesSection.tsx", "Manual patient votes"],
    ["components/internal/CallToBookClicksSection.tsx", "Call to book clicks"],
    ["components/internal/FinderInvitationRequestsSection.tsx", "Finder invitations"],
    ["components/internal/TrialConversionTable.tsx", "Trial conversions"],
    ["components/internal/InternalDirectoryClient.tsx", "Professional directory"],
  ];

  for (const [file, label] of tables) {
    it(`${label}: shows one page at a time with the pager under the table`, () => {
      const source = read(file);
      assert.match(source, /useTablePagination\(/, "pages its rows");
      assert.match(source, /<TablePagination/, "shows the pager");
      assert.match(source, /\bpaged\.rows\.map\(/, "renders only the current page");
    });
  }

  it("a table that needs state is a client component", () => {
    assert.match(read("components/internal/TrialConversionTable.tsx"), /^"use client";/);
  });

  it("changing the sort, range or filters goes back to the first page", () => {
    assert.match(read("components/internal/ManualPatientVotesSection.tsx"), /useTablePagination\(rows, \{\s*resetKey:/);
    assert.match(read("components/internal/CallToBookClicksSection.tsx"), /useTablePagination\(rows, \{\s*resetKey:/);
    assert.match(read("components/internal/InternalDirectoryClient.tsx"), /useTablePagination\(filtered, \{\s*resetKey:/);
  });

  it("the pager is a labelled navigation with Previous and Next", () => {
    const pager = read("components/internal/TablePagination.tsx");
    assert.match(pager, /<nav/);
    assert.match(pager, /aria-label/);
    assert.match(pager, />\s*Previous\s*</);
    assert.match(pager, />\s*Next\s*</);
    assert.match(pager, /pageCount <= 1/, "no pager for a single page");
  });
});
