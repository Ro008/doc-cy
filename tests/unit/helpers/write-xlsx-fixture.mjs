/**
 * Tiny helper for unit tests: write an .xlsx without importing `xlsx` into
 * Playwright-discovered *.test.ts files (xlsx is CJS and breaks ESM loaders).
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const xlsx = require("xlsx");

const [outPath, jsonPayload] = process.argv.slice(2);
if (!outPath || !jsonPayload) {
  console.error("Usage: node write-xlsx-fixture.mjs <outPath> <jsonRows>");
  process.exit(1);
}

const rows = JSON.parse(jsonPayload);
const wb = xlsx.utils.book_new();
const ws = xlsx.utils.json_to_sheet(rows);
xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
xlsx.writeFile(wb, outPath);
