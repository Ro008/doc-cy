import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const xlsx = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const scriptPath = path.join(repoRoot, "scripts", "generate-manual-directory-migration.mjs");

function writeWorkbook(filePath: string, rows: Array<Record<string, unknown>>) {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(rows);
  xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
  xlsx.writeFile(wb, filePath);
}

function runGenerator(args: string[]) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`generator failed:\n${result.stderr || result.stdout}`);
  }
  return result;
}

describe("generate-manual-directory-migration", () => {
  it("dedupes duplicate maps links by default", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "manual-dir-test-"));
    const inputPath = path.join(tempDir, "input.xlsx");
    const outputPath = path.join(tempDir, "out.sql");

    writeWorkbook(inputPath, [
      {
        name: "Iliada Evripidou",
        specialty: "pediatrician",
        district: "Paphos",
        phone: "26 848000",
        google_maps_url: "https://maps.google.com/?cid=shared",
        latitude: 34.7864954,
        longitude: 32.4379795,
      },
      {
        name: "Theodoros Athinodorou",
        specialty: "pediatrician",
        district: "Paphos",
        phone: "26 848000",
        google_maps_url: "https://maps.google.com/?cid=shared",
        latitude: 34.7864954,
        longitude: 32.4379795,
      },
    ]);

    const result = runGenerator(["--append", inputPath, outputPath]);
    const sql = fs.readFileSync(outputPath, "utf8");

    assert.match(result.stdout, /Skipped 1 duplicate google_maps_url row\(s\)\./);
    assert.equal((sql.match(/Iliada Evripidou/g) || []).length, 1);
    assert.equal((sql.match(/Theodoros Athinodorou/g) || []).length, 0);
  });

  it("keeps professionals with shared maps link when no-dedupe flag is enabled", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "manual-dir-test-"));
    const inputPath = path.join(tempDir, "input.xlsx");
    const outputPath = path.join(tempDir, "out.sql");

    writeWorkbook(inputPath, [
      {
        name: "Iliada Evripidou",
        specialty: "pediatrician",
        district: "Paphos",
        phone: "26 848000",
        google_maps_url: "https://maps.google.com/?cid=shared",
        latitude: 34.7864954,
        longitude: 32.4379795,
      },
      {
        name: "Theodoros Athinodorou",
        specialty: "pediatrician",
        district: "Paphos",
        phone: "26 848000",
        google_maps_url: "https://maps.google.com/?cid=shared",
        latitude: 34.7864954,
        longitude: 32.4379795,
      },
      {
        name: "CHATZIANTONIS GEORGIOS",
        specialty: "pediatrician",
        district: "Larnaca",
        google_maps_url: "https://maps.google.com/?cid=name-fix",
        latitude: 34.928585,
        longitude: 33.6153039,
      },
    ]);

    const result = runGenerator([
      "--append",
      "--no-dedupe-maps-url",
      inputPath,
      outputPath,
    ]);
    const sql = fs.readFileSync(outputPath, "utf8");

    assert.doesNotMatch(result.stdout, /Skipped \d+ duplicate google_maps_url row\(s\)\./);
    assert.equal((sql.match(/Iliada Evripidou/g) || []).length, 1);
    assert.equal((sql.match(/Theodoros Athinodorou/g) || []).length, 1);
    assert.equal((sql.match(/Georgios Chatziantonis/g) || []).length, 1);
    assert.equal((sql.match(/Chatziantonis Georgios/g) || []).length, 0);
    assert.ok(!sql.includes("or d.address_maps_link = v.address_maps_link"));
  });
});
