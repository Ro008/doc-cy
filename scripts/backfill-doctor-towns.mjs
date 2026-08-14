/**
 * Backfill doctors.town from clinic_address (Google formatted address).
 * Used for profiles that registered before the town column existed.
 *
 * Usage:
 *   node scripts/backfill-doctor-towns.mjs --env-file .env.testing.local --dry-run
 *   node scripts/backfill-doctor-towns.mjs --env-file .env.testing.local
 */

import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

const require = createRequire(import.meta.url);
const townsData = require("../lib/cyprus-towns-data.json");

const TOWN_BY_KEY = new Map();
for (const entry of townsData.entries ?? []) {
  const name = String(entry.name ?? "").trim();
  if (!name) continue;
  TOWN_BY_KEY.set(normalizeKey(name), name);
}
for (const [alias, canonical] of Object.entries(townsData.aliases ?? {})) {
  const resolved = TOWN_BY_KEY.get(normalizeKey(canonical)) ?? canonical;
  TOWN_BY_KEY.set(normalizeKey(alias), resolved);
}
const TOWN_KEYS_LONGEST_FIRST = [...TOWN_BY_KEY.keys()].sort((a, b) => b.length - a.length);

function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeTown(raw) {
  const key = normalizeKey(raw);
  if (!key) return null;
  const direct = TOWN_BY_KEY.get(key);
  if (direct) return direct;
  const withoutPostcode = key.replace(/\b\d{4}\b/g, " ").replace(/\s+/g, " ").trim();
  if (!withoutPostcode || withoutPostcode === key) return null;
  return TOWN_BY_KEY.get(withoutPostcode) ?? null;
}

function inferTownFromAddress(address) {
  const text = String(address ?? "").trim();
  if (!text) return null;
  for (const segment of text.split(",")) {
    const town = canonicalizeTown(segment);
    if (town) return town;
  }
  const normalized = ` ${normalizeKey(text)} `;
  for (const key of TOWN_KEYS_LONGEST_FIRST) {
    if (!key) continue;
    if (normalized.includes(` ${key} `)) return TOWN_BY_KEY.get(key) ?? null;
  }
  return null;
}

function parseArgs(argv) {
  const out = { envFile: ".env.testing.local", dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--env-file") out.envFile = argv[++i] ?? out.envFile;
  }
  return out;
}

async function fetchDoctors(supabase) {
  const out = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("doctors")
      .select("id, name, town, clinic_address, district, status")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`doctors: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  loadEnv({ path: path.resolve(args.envFile) });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in", args.envFile);
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const doctors = await fetchDoctors(supabase);
  const idsByTown = new Map();
  let alreadySet = 0;
  let inferred = 0;
  let skippedNoAddress = 0;
  let skippedUnknown = 0;
  const samples = [];

  for (const row of doctors) {
    const inferredTown = inferTownFromAddress(row.clinic_address);
    if (!inferredTown) {
      if (!String(row.clinic_address ?? "").trim()) skippedNoAddress += 1;
      else skippedUnknown += 1;
      continue;
    }
    if (row.town === inferredTown) {
      alreadySet += 1;
      continue;
    }
    inferred += 1;
    if (!idsByTown.has(inferredTown)) idsByTown.set(inferredTown, []);
    idsByTown.get(inferredTown).push(row.id);
    if (samples.length < 8) {
      samples.push({
        name: row.name,
        district: row.district,
        from: row.town,
        to: inferredTown,
        address: String(row.clinic_address ?? "").slice(0, 80),
      });
    }
  }

  if (!args.dryRun) {
    for (const [town, ids] of idsByTown) {
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { error } = await supabase.from("doctors").update({ town }).in("id", chunk);
        if (error) throw new Error(`doctors ${town}: ${error.message}`);
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun: args.dryRun,
        totalDoctors: doctors.length,
        alreadySet,
        updates: inferred,
        skippedNoAddress,
        skippedUnknown,
        samples,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
