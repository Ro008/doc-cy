/**
 * Import GeSY professionals from ALL.xlsx into directory_manual + clinics (batch mode).
 *
 * Safety:
 * - Does NOT touch registered professionals (signup / is_gesy toggle stay intact).
 * - Manual rows from GeSY are always is_gesy=true.
 * - Skips Pharmacy + Laboratory segments (later product surfaces).
 * - Inpatient Services–only people get finder_visible=false (clinic profiles only).
 *
 * Usage:
 *   node scripts/import-gesy-directory-batch.mjs --env-file .env.testing.local --xlsx "path/to/ALL.xlsx" --batch personal-doctor --dry-run
 *   node scripts/import-gesy-directory-batch.mjs --env-file .env.testing.local --xlsx "path/to/ALL.xlsx" --batch personal-doctor
 *
 * Batches:
 *   personal-doctor | dentist | allied | outpatient | nurse-midwife | accidents-emergency | inpatient-only
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { cleanGesyDirectoryDisplayName } from "./lib/gesy-directory-display-name.mjs";

const require = createRequire(import.meta.url);
const xlsx = require("xlsx");
const townsData = require("../lib/cyprus-towns-data.json");

const TOWN_BY_KEY = new Map();
for (const entry of townsData.entries ?? []) {
  const name = String(entry.name ?? "").trim();
  if (!name) continue;
  TOWN_BY_KEY.set(name.toLowerCase().replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim(), name);
}
for (const [alias, canonical] of Object.entries(townsData.aliases ?? {})) {
  const resolved = TOWN_BY_KEY.get(String(canonical).toLowerCase()) ?? canonical;
  TOWN_BY_KEY.set(String(alias).toLowerCase().replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim(), resolved);
}

function canonicalizeTown(raw) {
  const key = String(raw ?? "")
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!key) return null;
  return TOWN_BY_KEY.get(key) ?? null;
}

const VALID_DISTRICTS = new Set([
  "Nicosia",
  "Limassol",
  "Paphos",
  "Larnaca",
  "Famagusta",
]);

const EXCLUDED_SEGMENTS = new Set([
  "Pharmacy",
  "Laboratory",
]);

const INPATIENT_SEGMENT = "Inpatient Services";

const BATCH_SEGMENT_MAP = {
  "personal-doctor": new Set(["Personal Doctor"]),
  dentist: new Set(["Dentist"]),
  allied: new Set(["Allied Health Professional"]),
  outpatient: new Set(["Outpatient Specialist"]),
  "nurse-midwife": new Set(["Nurse or Midwife"]),
  "accidents-emergency": new Set(["Accidents & Emergency Department"]),
  "inpatient-only": new Set([INPATIENT_SEGMENT]),
};

const MAX_SLUG_LENGTH = 60;

const DISTRICT_SLUG = {
  Nicosia: "nicosia",
  Limassol: "limassol",
  Paphos: "paphos",
  Larnaca: "larnaca",
  Famagusta: "famagusta",
};

function parseArgs(argv) {
  const out = {
    envFile: ".env.testing.local",
    xlsx: "",
    batch: "",
    dryRun: false,
    sheet: "professionals",
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--env-file") out.envFile = argv[++i] ?? out.envFile;
    else if (arg === "--xlsx") out.xlsx = argv[++i] ?? "";
    else if (arg === "--batch") out.batch = argv[++i] ?? "";
    else if (arg === "--sheet") out.sheet = argv[++i] ?? out.sheet;
  }
  return out;
}

function fixSpecialtyTypos(label) {
  return String(label || "")
    .replace(/^\u039fral\b/u, "Oral")
    .replace(/^Οral\b/, "Oral")
    .trim();
}

function parseSpecialtyCell(raw) {
  const parts = String(raw ?? "")
    .split(";")
    .map((p) => {
      const fixed = fixSpecialtyTypos(p);
      if (/^h(?:ae|e)matology$/i.test(fixed)) return "Hematology";
      return fixed;
    })
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const part of parts) {
    if (seen.has(part)) continue;
    seen.add(part);
    out.push(part);
  }
  return out;
}

function slugify(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
}

function pickSlug(name, district, taken) {
  const districtSlug = DISTRICT_SLUG[district] || "";
  // Reserve room for "-{district}-{n}" so long clinic names don't collapse to one key.
  const suffixBudget = districtSlug ? districtSlug.length + 6 : 6; // "-nicosia-500"
  const maxBase = Math.max(12, MAX_SLUG_LENGTH - suffixBudget);
  const base = (slugify(name) || "professional").slice(0, maxBase).replace(/-+$/g, "") || "professional";
  const candidates = [];
  if (districtSlug) candidates.push(`${base}-${districtSlug}`);
  candidates.push(base);
  for (let i = 2; i <= 2000; i += 1) {
    if (districtSlug) candidates.push(`${base}-${districtSlug}-${i}`);
    candidates.push(`${base}-${i}`);
  }
  for (const c of candidates) {
    const key = c.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, "").toLowerCase();
    if (!key || taken.has(key)) continue;
    taken.add(key);
    return key;
  }
  throw new Error(`Could not allocate slug for ${name}`);
}

function parseLatLonFromMaps(mapsUrl) {
  const raw = String(mapsUrl ?? "");
  const m = raw.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (!m) return { latitude: null, longitude: null };
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { latitude: null, longitude: null };
  }
  return { latitude, longitude };
}

function normalizeGender(raw) {
  const g = String(raw ?? "").trim().toLowerCase();
  if (g === "female" || g === "f") return "female";
  if (g === "male" || g === "m") return "male";
  return null;
}

function isBookableSegment(segment) {
  return Boolean(segment) && !EXCLUDED_SEGMENTS.has(segment) && segment !== INPATIENT_SEGMENT;
}

function personBelongsInBatch(person, batchKey) {
  const segments = person.segments;
  if (batchKey === "inpatient-only") {
    return segments.has(INPATIENT_SEGMENT) && ![...segments].some(isBookableSegment);
  }
  const wanted = BATCH_SEGMENT_MAP[batchKey];
  if (!wanted) return false;
  // Include if they have the batch segment AND at least one bookable (non pharmacy/lab) presence,
  // OR for batches that are themselves bookable: just having that segment.
  if (![...segments].some((s) => wanted.has(s))) return false;
  // Skip pure pharmacy/lab people (they never appear in bookable batches).
  if (![...segments].some((s) => !EXCLUDED_SEGMENTS.has(s))) return false;
  return true;
}

function aggregatePeople(rows) {
  /** @type {Map<string, any>} */
  const byGhs = new Map();
  for (const row of rows) {
    const ghs = String(row.ghs_code ?? "").trim();
    if (!ghs) continue;
    const segment = String(row.segment ?? "").trim();
    if (!segment) continue;

    if (!byGhs.has(ghs)) {
      byGhs.set(ghs, {
        ghs_code: ghs,
        name: cleanGesyDirectoryDisplayName(String(row.name ?? "").trim()),
        email: String(row.email ?? "").trim() || null,
        gender: normalizeGender(row.gender),
        segments: new Set(),
        specialties: new Set(),
        clinics: new Map(), // clinic_ghs -> clinic payload
        phones: new Set(),
        addresses: [],
        districts: new Set(),
        maps: [],
      });
    }
    const person = byGhs.get(ghs);
    person.segments.add(segment);
    for (const spec of parseSpecialtyCell(row.specialty)) person.specialties.add(spec);

    const clinicGhs = String(row.clinic_ghs_code ?? "").trim();
    const clinicName = String(row.clinic_name ?? "").trim();
    const district = String(row.district ?? "").trim();
    const phone = String(row.phone ?? "").trim() || null;
    const address = String(row.address ?? "").trim() || null;
    const maps = String(row.GoogleMaps ?? "").trim() || null;
    const town = canonicalizeTown(row.town);
    const { latitude, longitude } = parseLatLonFromMaps(maps);

    if (phone) person.phones.add(phone);
    if (address) person.addresses.push(address);
    if (maps) person.maps.push(maps);
    if (VALID_DISTRICTS.has(district)) person.districts.add(district);

    if (clinicGhs && clinicName && VALID_DISTRICTS.has(district)) {
      if (!person.clinics.has(clinicGhs)) {
        person.clinics.set(clinicGhs, {
          ghs_code: clinicGhs,
          name: clinicName,
          district,
          address,
          phone,
          address_maps_link: maps,
          latitude,
          longitude,
          town,
          segments: new Set([segment]),
        });
      } else {
        const c = person.clinics.get(clinicGhs);
        c.segments.add(segment);
        if (!c.address && address) c.address = address;
        if (!c.town && town) c.town = town;
        if (!c.phone && phone) c.phone = phone;
        if (!c.address_maps_link && maps) {
          c.address_maps_link = maps;
          c.latitude = latitude;
          c.longitude = longitude;
        }
      }
    }
  }
  return byGhs;
}

function computeFinderVisible(person) {
  return [...person.segments].some(isBookableSegment);
}

function primarySegment(person, batchKey) {
  if (batchKey === "inpatient-only") return INPATIENT_SEGMENT;
  const wanted = BATCH_SEGMENT_MAP[batchKey];
  for (const s of person.segments) {
    if (wanted?.has(s)) return s;
  }
  for (const s of person.segments) {
    if (isBookableSegment(s)) return s;
  }
  return [...person.segments][0] ?? null;
}

async function loadAllSlugsFromTable(supabase, table) {
  const out = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select("slug")
      .not("slug", "is", null)
      .range(from, to);
    if (error) throw new Error(`Load slugs from ${table}: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

async function loadTakenSlugs(supabase) {
  const taken = new Set();
  const [doctorsRows, manualRows, clinicsRows] = await Promise.all([
    loadAllSlugsFromTable(supabase, "doctors"),
    loadAllSlugsFromTable(supabase, "directory_manual"),
    loadAllSlugsFromTable(supabase, "clinics"),
  ]);
  for (const row of [...doctorsRows, ...manualRows, ...clinicsRows]) {
    const s = String(row.slug ?? "").trim().toLowerCase();
    if (s) taken.add(s);
  }
  return taken;
}

async function upsertClinic(supabase, clinic, takenSlugs, dryRun) {
  const existing = await supabase
    .from("clinics")
    .select("id, slug")
    .eq("ghs_code", clinic.ghs_code)
    .eq("is_archived", false)
    .maybeSingle();

  if (existing.data?.id) {
    if (!dryRun) {
      await supabase
        .from("clinics")
        .update({
          name: clinic.name,
          district: clinic.district,
          address: clinic.address,
          phone: clinic.phone,
          address_maps_link: clinic.address_maps_link,
          latitude: clinic.latitude,
          longitude: clinic.longitude,
          town: clinic.town ?? null,
        })
        .eq("id", existing.data.id);
    }
    return { id: existing.data.id, slug: existing.data.slug };
  }

  // Prefer a stable unique suffix from ghs_code when the display name collides
  // (common for solo practices that share a person's name across GHS codes).
  const ghsSlug = String(clinic.ghs_code || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12);
  const nameForSlug = ghsSlug ? `${clinic.name} ${ghsSlug}` : clinic.name;
  let slug = pickSlug(nameForSlug, clinic.district, takenSlugs);
  if (dryRun) return { id: `dry-clinic-${clinic.ghs_code}`, slug };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const insert = await supabase
      .from("clinics")
      .insert({
        name: clinic.name,
        slug,
        district: clinic.district,
        address: clinic.address,
        phone: clinic.phone,
        address_maps_link: clinic.address_maps_link,
        latitude: clinic.latitude,
        longitude: clinic.longitude,
        ghs_code: clinic.ghs_code,
        town: clinic.town ?? null,
        is_archived: false,
      })
      .select("id, slug")
      .single();

    if (!insert.error) return insert.data;

    const isSlugConflict = /clinics_slug_unique|duplicate key/i.test(insert.error.message || "");
    if (!isSlugConflict || attempt === 4) {
      throw new Error(`Clinic insert ${clinic.ghs_code}: ${insert.error.message}`);
    }
    // Another row took this slug (stale taken set / race). Reserve and retry.
    takenSlugs.add(slug);
    slug = pickSlug(`${clinic.name} ${ghsSlug || "clinic"} ${attempt + 2}`, clinic.district, takenSlugs);
  }

  throw new Error(`Clinic insert ${clinic.ghs_code}: exhausted slug retries`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.xlsx || !args.batch) {
    console.error(
      "Usage: node scripts/import-gesy-directory-batch.mjs --xlsx <ALL.xlsx> --batch <name> [--env-file .env.testing.local] [--dry-run]",
    );
    console.error("Batches:", Object.keys(BATCH_SEGMENT_MAP).join(", "));
    process.exit(1);
  }
  if (!BATCH_SEGMENT_MAP[args.batch]) {
    console.error("Unknown batch:", args.batch);
    process.exit(1);
  }
  if (!fs.existsSync(args.xlsx)) {
    console.error("XLSX not found:", args.xlsx);
    process.exit(1);
  }

  loadEnv({ path: path.resolve(args.envFile) });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in", args.envFile);
    process.exit(1);
  }

  const wb = xlsx.readFile(args.xlsx);
  const sheet = wb.Sheets[args.sheet];
  if (!sheet) {
    console.error("Sheet not found:", args.sheet, "available:", wb.SheetNames.join(", "));
    process.exit(1);
  }
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });
  const people = aggregatePeople(rows);
  const batchPeople = [...people.values()].filter((p) => personBelongsInBatch(p, args.batch));

  console.log(`Batch=${args.batch} people=${batchPeople.length} dryRun=${args.dryRun}`);

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const takenSlugs = await loadTakenSlugs(supabase);

  let imported = 0;
  let linkedClinics = 0;
  let skippedNoDistrict = 0;

  for (const person of batchPeople) {
    const district = [...person.districts][0];
    if (!district || !VALID_DISTRICTS.has(district)) {
      skippedNoDistrict += 1;
      continue;
    }

    const specialties = [...person.specialties];
    if (specialties.length === 0) continue;

    // Prefer clinics from bookable segments; for inpatient-only batch use all clinics.
    const clinicEntries = [...person.clinics.values()].filter((c) => {
      if (args.batch === "inpatient-only") return true;
      return [...c.segments].some((s) => !EXCLUDED_SEGMENTS.has(s));
    });

    const clinicIdByGhs = new Map();
    for (const clinic of clinicEntries) {
      const upserted = await upsertClinic(supabase, clinic, takenSlugs, args.dryRun);
      clinicIdByGhs.set(clinic.ghs_code, upserted.id);
      linkedClinics += 1;
    }

    const primaryClinicId = clinicIdByGhs.values().next().value ?? null;
    const primaryClinic =
      clinicEntries.find((c) => clinicIdByGhs.get(c.ghs_code) === primaryClinicId) ??
      clinicEntries[0] ??
      null;

    const phone = [...person.phones][0] ?? primaryClinic?.phone ?? null;
    const address = person.addresses[0] ?? primaryClinic?.address ?? null;
    const maps = person.maps[0] ?? primaryClinic?.address_maps_link ?? null;
    const coords = parseLatLonFromMaps(maps);
    const finderVisible = computeFinderVisible(person);
    const segment = primarySegment(person, args.batch);

    const existing = await supabase
      .from("directory_manual")
      .select("id, slug")
      .eq("ghs_code", person.ghs_code)
      .eq("is_archived", false)
      .maybeSingle();

    let manualId = existing.data?.id ?? null;
    let slug = existing.data?.slug ?? null;

    const payload = {
      name: cleanGesyDirectoryDisplayName(person.name),
      specialty: specialties[0],
      specialties,
      district,
      town: primaryClinic?.town ?? null,
      address_maps_link: maps,
      phone,
      address,
      latitude: coords.latitude ?? primaryClinic?.latitude ?? null,
      longitude: coords.longitude ?? primaryClinic?.longitude ?? null,
      email: person.email,
      gender: person.gender,
      ghs_code: person.ghs_code,
      is_gesy: true,
      finder_visible: finderVisible,
      segment,
      clinic_id: primaryClinicId,
      is_archived: false,
    };

    if (!manualId) {
      slug = pickSlug(person.name, district, takenSlugs);
      if (!args.dryRun) {
        const insert = await supabase
          .from("directory_manual")
          .insert({ ...payload, slug })
          .select("id, slug")
          .single();
        if (insert.error) {
          console.error("Insert failed", person.ghs_code, insert.error.message);
          continue;
        }
        manualId = insert.data.id;
        slug = insert.data.slug;
      } else {
        manualId = `dry-${person.ghs_code}`;
      }
    } else if (!args.dryRun) {
      const update = await supabase.from("directory_manual").update(payload).eq("id", manualId);
      if (update.error) {
        console.error("Update failed", person.ghs_code, update.error.message);
        continue;
      }
    }

    if (!args.dryRun && manualId) {
      await supabase.from("directory_manual_clinics").delete().eq("directory_manual_id", manualId);
      const links = [...clinicIdByGhs.entries()].map(([ghs, clinicId], index) => ({
        directory_manual_id: manualId,
        clinic_id: clinicId,
        is_primary: index === 0 || clinicId === primaryClinicId,
      }));
      // Ensure only one primary
      let sawPrimary = false;
      for (const link of links) {
        if (link.is_primary && !sawPrimary) {
          sawPrimary = true;
        } else {
          link.is_primary = false;
        }
      }
      if (links.length && !sawPrimary) links[0].is_primary = true;
      if (links.length) {
        const linkRes = await supabase.from("directory_manual_clinics").insert(links);
        if (linkRes.error) {
          console.error("Link clinics failed", person.ghs_code, linkRes.error.message);
        }
      }
    }

    imported += 1;
    if (imported % 100 === 0) {
      console.log(`… ${imported}/${batchPeople.length}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        batch: args.batch,
        dryRun: args.dryRun,
        imported,
        clinicUpsertTouches: linkedClinics,
        skippedNoDistrict,
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
