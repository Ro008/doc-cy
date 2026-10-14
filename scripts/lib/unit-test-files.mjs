// Pure pieces of scripts/run-unit-tests.mjs (unit-tested in tests/unit/run-unit-tests.test.ts).

import fs from "node:fs";

/** Every `*.test.ts` in `dir`, sorted, as `<prefix>/<file>` (forward slashes on every OS). */
export function listUnitTestFiles(dir, prefix = "tests/unit") {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".test.ts"))
    .sort()
    .map((name) => `${prefix}/${name}`);
}

/**
 * Splits `items` into consecutive chunks whose command-line length (each item plus one space)
 * stays within `maxChars`. An item longer than the budget gets a chunk of its own; no chunk is
 * empty. Windows cmd.exe refuses a command line over 8191 characters, which a list of every unit
 * test file outgrew.
 */
export function chunkByLength(items, maxChars) {
  const chunks = [];
  let current = [];
  let length = 0;
  for (const item of items) {
    const cost = item.length + 1;
    if (current.length > 0 && length + cost > maxChars) {
      chunks.push(current);
      current = [];
      length = 0;
    }
    current.push(item);
    length += cost;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
