import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const scriptPath = path.join(repoRoot, "scripts", "generate-manual-directory-migration.mjs");
const writeXlsxHelper = path.join(__dirname, "helpers", "write-xlsx-fixture.mjs");

function writeWorkbook(filePath: string, rows: Array<Record<string, unknown>>) {
  const result = spawnSync(
    process.execPath,
    [writeXlsxHelper, filePath, JSON.stringify(rows)],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`write-xlsx-fixture failed:\n${result.stderr || result.stdout}`);
  }
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
    assert.match(sql, /lower\(d\.name\) = lower\(v\.name\)/);
    assert.match(sql, /d\.district = v\.district::public\.cyprus_district/);
    assert.match(sql, /lower\(trim\(d\.specialty\)\) = lower\(trim\(v\.specialty\)\)/);
    assert.ok(!sql.includes("or d.address_maps_link = v.address_maps_link"));
  });

  it("append dedupes by name + specialty + district, not name alone", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "manual-dir-test-"));
    const inputPath = path.join(tempDir, "input.xlsx");
    const outputPath = path.join(tempDir, "out.sql");

    writeWorkbook(inputPath, [
      {
        name: "Andreas Matheou",
        specialty: "gynecologist",
        district: "Paphos",
        phone: "99 055649",
        google_maps_url: "https://maps.google.com/?cid=paphos-a",
        latitude: 34.76,
        longitude: 32.43,
      },
      {
        name: "Andreas Matheou",
        specialty: "gynecologist",
        district: "Paphos",
        phone: "99 055649",
        google_maps_url: "https://maps.google.com/?cid=paphos-b",
        latitude: 35.03,
        longitude: 32.42,
      },
      {
        name: "Andreas Matheou",
        specialty: "gynecologist",
        district: "Nicosia",
        phone: "22 000000",
        google_maps_url: "https://maps.google.com/?cid=nicosia",
        latitude: 35.17,
        longitude: 33.36,
      },
    ]);

    runGenerator(["--append", "--no-dedupe-maps-url", inputPath, outputPath]);
    const sql = fs.readFileSync(outputPath, "utf8");

    assert.equal((sql.match(/Andreas Matheou/g) || []).length, 3);
    assert.ok(!sql.includes("or d.address_maps_link = v.address_maps_link"));
  });
});
