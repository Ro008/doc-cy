import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { chunkByLength, listUnitTestFiles } from "../../scripts/lib/unit-test-files.mjs";

describe("listUnitTestFiles", () => {
  function tmpDirWith(names: string[]): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "unit-files-"));
    for (const name of names) fs.writeFileSync(path.join(dir, name), "");
    return dir;
  }

  it("returns every *.test.ts of the folder, sorted, as repo-relative forward-slash paths", () => {
    const dir = tmpDirWith(["b.test.ts", "a.test.ts", "c-d.test.ts"]);
    assert.deepEqual(listUnitTestFiles(dir, "tests/unit"), [
      "tests/unit/a.test.ts",
      "tests/unit/b.test.ts",
      "tests/unit/c-d.test.ts",
    ]);
  });

  it("leaves out anything that is not a test file", () => {
    const dir = tmpDirWith(["a.test.ts", "helper.ts", "notes.md", "b.test.tsx", "c.test.ts.bak"]);
    assert.deepEqual(listUnitTestFiles(dir, "tests/unit"), ["tests/unit/a.test.ts"]);
  });

  it("finds every test in the real folder, so a new test file is run without registering it", () => {
    const listed = new Set(listUnitTestFiles(path.join(process.cwd(), "tests", "unit"), "tests/unit"));
    for (const file of fs.readdirSync(path.join(process.cwd(), "tests", "unit"))) {
      if (file.endsWith(".test.ts")) assert.ok(listed.has(`tests/unit/${file}`), `${file} would not run`);
    }
  });
});

describe("chunkByLength", () => {
  const files = Array.from({ length: 50 }, (_, i) => `tests/unit/file-number-${i}.test.ts`);

  it("keeps every item, in order, split into chunks", () => {
    const chunks = chunkByLength(files, 300);
    assert.ok(chunks.length > 1);
    assert.deepEqual(chunks.flat(), files);
  });

  it("keeps each chunk's command-line length within the budget (items plus a space each)", () => {
    for (const budget of [120, 300, 1000]) {
      for (const chunk of chunkByLength(files, budget)) {
        const length = chunk.reduce((sum, item) => sum + item.length + 1, 0);
        assert.ok(length <= budget, `${length} > ${budget}`);
      }
    }
  });

  it("never makes an empty chunk, and gives an over-long item a chunk of its own", () => {
    const chunks = chunkByLength(["short.ts", "x".repeat(500), "tail.ts"], 100);
    assert.deepEqual(chunks, [["short.ts"], ["x".repeat(500)], ["tail.ts"]]);
    assert.deepEqual(chunkByLength([], 100), []);
  });

  it("is one chunk when everything fits", () => {
    assert.deepEqual(chunkByLength(["a", "b", "c"], 1000), [["a", "b", "c"]]);
  });
});

describe("package.json test:unit", () => {
  it("runs the launcher, not a hand-kept list that outgrows the Windows command line", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    assert.equal(pkg.scripts["test:unit"], "node scripts/run-unit-tests.mjs");
  });
});
