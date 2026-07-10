import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, "generate-manual-directory-migration.mjs");

console.warn(
  "generate-dentist-directory-migration.mjs is deprecated. Use generate-manual-directory-migration.mjs instead.",
);

const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
