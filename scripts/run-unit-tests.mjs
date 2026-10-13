// Runs every unit test in tests/unit (npm run test:unit).
//
// The files are found in the folder, not listed by hand: a new `*.test.ts` runs without being
// registered anywhere. They run in batches, because one command naming them all outgrew the Windows
// command-line limit (8191 characters). Each file still runs in its own process (node --test), so
// the batches change nothing about isolation. Exit code is non-zero if any batch fails.
//
//   npm run test:unit
//   npm run test:unit -- tests/unit/doctor-routes.test.ts   (only these files)

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chunkByLength, listUnitTestFiles } from "./lib/unit-test-files.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Well under cmd.exe's 8191, which also counts `npx --yes tsx --test` and the shell wrapper.
const MAX_CHARS_PER_BATCH = 5000;

const requested = process.argv.slice(2);
const files = requested.length > 0 ? requested : listUnitTestFiles(path.join(repoRoot, "tests", "unit"));
const batches = chunkByLength(files, MAX_CHARS_PER_BATCH);

let failed = 0;
batches.forEach((batch, index) => {
  if (batches.length > 1) console.log(`# batch ${index + 1}/${batches.length}: ${batch.length} files`);
  const result = spawnSync("npx", ["--yes", "tsx", "--test", ...batch], {
    cwd: repoRoot,
    stdio: "inherit",
    // npx is npx.cmd on Windows, which needs a shell.
    shell: process.platform === "win32",
  });
  if (result.status !== 0) failed += 1;
});

console.log(`# ${files.length} test files in ${batches.length} batch(es), ${failed} batch(es) failed`);
process.exit(failed > 0 ? 1 : 0);
