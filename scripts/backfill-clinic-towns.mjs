/**
 * Backfill clinics.town + directory_manual.town from ALL.xlsx (GeSY town column).
 *
 * Usage:
 *   node scripts/backfill-clinic-towns.mjs --env-file .env.testing.local --xlsx "c:/Users/User/Downloads/ALL.xlsx" --dry-run
 *   node scripts/backfill-clinic-towns.mjs --env-file .env.testing.local --xlsx "c:/Users/User/Downloads/ALL.xlsx"
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

const require = createRequire(import.meta.url);
const xlsx = require("xlsx");
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

function normalizeKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeTown(raw) {
  const key = normalizeKey(raw);
  if (!key) return null;
  return TOWN_BY_KEY.get(key) ?? null;
}

function parseArgs(argv) {
  const out = { envFile: ".env.testing.local", xlsx: "", dryRun: false, sheet: "professionals" };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--env-file") out.envFile = argv[++i] ?? out.envFile;
    else if (arg === "--xlsx") out.xlsx = argv[++i] ?? "";
    else if (arg === "--sheet") out.sheet = argv[++i] ?? out.sheet;
  }
  return out;
}

async function fetchAll(supabase, table, columns) {
  const out = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("is_archived", false)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.xlsx || !fs.existsSync(args.xlsx)) {
    console.error("Usage: node scripts/backfill-clinic-towns.mjs --xlsx <ALL.xlsx> [--env-file .env.testing.local] [--dry-run]");
    process.exit(1);
  }
  loadEnv({ path: path.resolve(args.envFile) });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in", args.envFile);
    process.exit(1);
  }

  const rows = xlsx.utils.sheet_to_json(xlsx.readFile(args.xlsx).Sheets[args.sheet], { defval: null });
  const townByClinicGhs = new Map();
  for (const row of rows) {
    const ghs = String(row.clinic_ghs_code ?? "").trim();
    const town = canonicalizeTown(row.town);
    if (!ghs || !town || townByClinicGhs.has(ghs)) continue;
    townByClinicGhs.set(ghs, town);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const clinics = await fetchAll(supabase, "clinics", "id, ghs_code, town");
  const clinicIdsByTown = new Map();
  let clinicUpdates = 0;
  let clinicSkipped = 0;
  for (const clinic of clinics) {
    const ghs = String(clinic.ghs_code ?? "").trim();
    const town = townByClinicGhs.get(ghs);
    if (!town) {
      clinicSkipped += 1;
      continue;
    }
    if (clinic.town === town) continue;
    clinicUpdates += 1;
    if (!clinicIdsByTown.has(town)) clinicIdsByTown.set(town, []);
    clinicIdsByTown.get(town).push(clinic.id);
  }

  const manuals = await fetchAll(supabase, "directory_manual", "id, clinic_id, town");
  const townByClinicId = new Map();
  for (const clinic of clinics) {
    const ghs = String(clinic.ghs_code ?? "").trim();
    const town = townByClinicGhs.get(ghs) ?? clinic.town;
    if (town) townByClinicId.set(clinic.id, town);
  }
  const manualIdsByTown = new Map();
  let manualUpdates = 0;
  for (const row of manuals) {
    const town = townByClinicId.get(row.clinic_id) ?? null;
    if (!town || row.town === town) continue;
    manualUpdates += 1;
    if (!manualIdsByTown.has(town)) manualIdsByTown.set(town, []);
    manualIdsByTown.get(town).push(row.id);
  }

  async function applyTownUpdates(table, idsByTown) {
    if (args.dryRun) return;
    for (const [town, ids] of idsByTown) {
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { error } = await supabase.from(table).update({ town }).in("id", chunk);
        if (error) throw new Error(`${table} ${town}: ${error.message}`);
      }
    }
  }

  await applyTownUpdates("clinics", clinicIdsByTown);
  await applyTownUpdates("directory_manual", manualIdsByTown);

  console.log(
    JSON.stringify(
      {
        dryRun: args.dryRun,
        excelClinicTowns: townByClinicGhs.size,
        clinicUpdates,
        clinicSkippedNoMap: clinicSkipped,
        manualUpdates,
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
