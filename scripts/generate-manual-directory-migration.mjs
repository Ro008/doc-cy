import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { cleanManualDirectoryPersonName } from "./lib/manual-directory-name-clean.mjs";

const require = createRequire(import.meta.url);
const xlsx = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const CYPRUS_MASTER_SPECIALTIES = [
  "General Practice",
  "Dentistry",
  "Pediatrics",
  "Dermatology",
  "Gynecology",
  "Laser & Medical Aesthetics",
  "Physiotherapy & Rehabilitation",
  "Psychology",
  "Nutrition & Dietetics",
  "Wellness",
  "Cardiology",
  "Orthopedics",
  "Ophthalmology",
  "ENT",
  "Urology",
  "Psychiatry",
  "Endocrinology",
  "Oncology",
  "Neurology",
  "Gastroenterology",
  "Pulmonology",
  "Rheumatology",
  "Nephrology",
];

const VALID_DISTRICTS = new Set([
  "Nicosia",
  "Limassol",
  "Paphos",
  "Larnaca",
  "Famagusta",
]);

const GYNECOLOGY_GROUP = new Set([
  "gynecologic oncology",
  "gynecology",
  "obstetrics/gynecology",
  "obstetrician",
  "obstetrics",
]);

const PHYSIOTHERAPY_GROUP = new Set([
  "physiotherapy",
  "physiotherapy & rehabilitation",
  "physiotherapist",
  "physical therapy",
]);

const PSYCHOLOGY_GROUP = new Set([
  "psychology",
  "psychotherapy",
  "psychologist",
  "psychiatrist",
]);

const DENTISTRY_GROUP = new Set([
  "dentistry",
  "dentist",
  "dentists",
  "dental",
  "pediatric dentistry",
  "cosmetic dentistry",
  "orthodontics",
  "endodontics",
  "oral surgery",
]);

const DERMATOLOGY_GROUP = new Set([
  "dermatology",
  "dermatologist",
  "dermatologists",
]);

const SPECIALTY_ALIASES = {
  gp: "General Practice",
  "general practitioner": "General Practice",
  "family medicine": "General Practice",
  "family doctor": "General Practice",
  "personal doctor": "General Practice",
  pediatrics: "Pediatrics",
  pediatrician: "Pediatrics",
  paediatrics: "Pediatrics",
  nutrition: "Nutrition & Dietetics",
  dietetics: "Nutrition & Dietetics",
  dietitian: "Nutrition & Dietetics",
  nutritionist: "Nutrition & Dietetics",
  "laser medical aesthetics": "Laser & Medical Aesthetics",
  "laser & medical aesthetics": "Laser & Medical Aesthetics",
  aesthetics: "Laser & Medical Aesthetics",
  ent: "ENT",
  "ear nose throat": "ENT",
  ophthalmologist: "Ophthalmology",
  ophthalmology: "Ophthalmology",
  ophtalmologist: "Ophthalmology",
  ophtalmology: "Ophthalmology",
  cardiologist: "Cardiology",
  cardiology: "Cardiology",
  orthopedics: "Orthopedics",
  orthopaedic: "Orthopedics",
  urologist: "Urology",
  neurologist: "Neurology",
  oncologist: "Oncology",
  gastroenterologist: "Gastroenterology",
  pulmonologist: "Pulmonology",
  rheumatologist: "Rheumatology",
  nephrologist: "Nephrology",
  endocrinologist: "Endocrinology",
  midwifery: "Gynecology",
  midwife: "Gynecology",
  "plastic surgery": "Plastic Surgery",
  "holistic cosmetology": "Holistic Cosmetology",
  therapy: "Therapy",
  "speech therapy": "Speech Therapy",
};

function parseArgs(argv) {
  const flags = {
    mode: "replace",
    dedupeMapsUrl: true,
    dedupeSpreadsheetPerson: false,
    normalizeNames: false,
  };
  const positionals = [];

  for (const arg of argv) {
    if (arg === "--append") {
      flags.mode = "append";
    } else if (arg === "--replace") {
      flags.mode = "replace";
    } else if (arg === "--no-dedupe-maps-url") {
      flags.dedupeMapsUrl = false;
    } else if (arg === "--dedupe-spreadsheet-person") {
      flags.dedupeSpreadsheetPerson = true;
    } else if (arg === "--normalize-names") {
      flags.normalizeNames = true;
    } else if (arg.startsWith("--mode=")) {
      flags.mode = arg.slice("--mode=".length);
    } else {
      positionals.push(arg);
    }
  }

  if (!["replace", "append"].includes(flags.mode)) {
    throw new Error(`Invalid mode "${flags.mode}". Use "replace" or "append".`);
  }

  const inputPath =
    positionals[0] ??
    path.join(process.env.USERPROFILE ?? "", "Downloads", "manual-directory.xlsx");
  const outputPath =
    positionals[1] ??
    path.join(
      repoRoot,
      "supabase",
      "migrations",
      `${formatTimestamp()}_directory_manual_import.sql`,
    );

  return { ...flags, inputPath, outputPath };
}

function formatTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
  ].join("");
}

function specialtyMatchKey(raw) {
  return String(raw ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .trim();
}

function toTitleCaseWords(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word === "&") return word;
      return word
        .split("-")
        .map((part) => {
          const lower = part.toLowerCase();
          return lower ? `${lower.charAt(0).toUpperCase()}${lower.slice(1)}` : "";
        })
        .join("-");
    })
    .join(" ");
}

function normalizeSpecialty(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    throw new Error("Row is missing specialty");
  }

  const key = specialtyMatchKey(trimmed);
  if (SPECIALTY_ALIASES[key]) return SPECIALTY_ALIASES[key];
  if (GYNECOLOGY_GROUP.has(key)) return "Gynecology";
  if (PHYSIOTHERAPY_GROUP.has(key)) return "Physiotherapy & Rehabilitation";
  if (PSYCHOLOGY_GROUP.has(key)) return "Psychology";
  if (DENTISTRY_GROUP.has(key)) return "Dentistry";
  if (DERMATOLOGY_GROUP.has(key)) return "Dermatology";

  for (const master of CYPRUS_MASTER_SPECIALTIES) {
    if (specialtyMatchKey(master) === key) return master;
  }

  return toTitleCaseWords(trimmed);
}

function formatPersonName(name) {
  const raw = String(name ?? "").trim();
  const normalizedUpper = raw.toUpperCase().replace(/\s+/g, " ");
  // Some spreadsheets provide "SURNAME NAME" in caps; prefer "NAME SURNAME".
  if (normalizedUpper === "CHATZIANTONIS GEORGIOS") {
    return "Georgios Chatziantonis";
  }
  return toTitleCaseWords(raw);
}

function isClinicStyleName(name) {
  const normalized = String(name ?? "").trim();
  if (!normalized) return false;
  return /\b(center|centre|clinic|studio|hospital|medical centre|medical center)\b/i.test(
    normalized,
  );
}

function sqlLiteral(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function normalizePhone(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function personDedupeKey(name, district, phone) {
  const phoneDigits = String(phone ?? "").replace(/\D/g, "");
  return `${name.toLowerCase()}|${district}|${phoneDigits}`;
}

const MAX_SLUG_LENGTH = 60;
const DISTRICT_SLUG = {
  Nicosia: "nicosia",
  Limassol: "limassol",
  Paphos: "paphos",
  Larnaca: "larnaca",
  Famagusta: "famagusta",
};

function slugifyDoctorPublicName(name) {
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

function trimSlug(value) {
  return value.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, "");
}

function buildManualDirectorySlugCandidates({ name, district, preferDistrictSuffix = false }) {
  const nameSlug = slugifyDoctorPublicName(name);
  const base = nameSlug || "professional";
  const candidates = [];
  const seen = new Set();

  const push = (value) => {
    const normalized = trimSlug(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) return;
    seen.add(key);
    candidates.push(normalized);
  };

  if (preferDistrictSuffix && district && DISTRICT_SLUG[district]) {
    const withDistrict = `${base}-${DISTRICT_SLUG[district]}`;
    push(withDistrict);
    for (let suffix = 2; suffix <= 200; suffix += 1) {
      push(`${withDistrict}-${suffix}`);
    }
  }

  push(base);
  if (!preferDistrictSuffix && district && DISTRICT_SLUG[district]) {
    push(`${base}-${DISTRICT_SLUG[district]}`);
  }
  for (let suffix = 2; suffix <= 200; suffix += 1) {
    push(`${base}-${suffix}`);
  }
  return candidates;
}

function allocateImportSlug(takenLowercase, name, district, preferDistrictSuffix = false) {
  const candidates = buildManualDirectorySlugCandidates({
    name,
    district,
    preferDistrictSuffix,
  });
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (!takenLowercase.has(key)) {
      takenLowercase.add(key);
      return candidate;
    }
  }
  throw new Error(`Could not allocate slug for import row "${name}" (${district})`);
}

function assignImportSlugs(entries, { preferDistrictSuffix = false } = {}) {
  const taken = new Set();
  for (const entry of entries) {
    entry.slug = allocateImportSlug(
      taken,
      entry.name,
      entry.district,
      preferDistrictSuffix,
    );
  }
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function pickField(row, keys) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [
    key.trim().toLowerCase(),
    value,
  ]);

  for (const wanted of keys) {
    const wantedKey = wanted.toLowerCase();
    const hit = normalizedEntries.find(([key]) => key === wantedKey);
    if (hit && String(hit[1] ?? "").trim() !== "") {
      return hit[1];
    }
  }

  return "";
}

function buildReplaceMigration(entries, sourceLabel) {
  const valueLines = entries.map((entry) => {
    const phoneSql = entry.phone ? sqlLiteral(entry.phone) : "null";
    const latSql = entry.latitude === null ? "null" : String(entry.latitude);
    const lonSql = entry.longitude === null ? "null" : String(entry.longitude);

    return `  (${sqlLiteral(entry.name)}, ${sqlLiteral(entry.specialty)}, ${sqlLiteral(entry.district)}::public.cyprus_district, ${sqlLiteral(entry.address_maps_link)}, ${phoneSql}, ${latSql}, ${lonSql}, ${sqlLiteral(entry.slug)})`;
  });

  return `-- Reset manual directory from spreadsheet (${sourceLabel}).

alter table public.directory_manual
  add column if not exists phone text;

alter table public.directory_manual
  add column if not exists slug text;

comment on column public.directory_manual.phone is
  'Optional clinic phone shown to patients when online booking is not activated yet.';

delete from public.directory_manual;

insert into public.directory_manual (
  name,
  specialty,
  district,
  address_maps_link,
  phone,
  latitude,
  longitude,
  slug
)
values
${valueLines.join(",\n")};
`;
}

/** SQL fragment: imported specialty matches an existing row (incl. legacy Ob/Gyn labels). */
function appendSpecialtyMatchSql(vAlias = "v") {
  return `(
      lower(trim(d.specialty)) = lower(trim(${vAlias}.specialty))
      or (
        lower(trim(${vAlias}.specialty)) = 'gynecology'
        and lower(trim(d.specialty)) in (
          'gynecology',
          'obstetrics/ gynecology',
          'gynecologic oncology'
        )
      )
    )`;
}

function buildAppendExistsClause(dedupeMapsUrl) {
  const identityMatch = `
      lower(d.name) = lower(v.name)
      and d.district = v.district::public.cyprus_district
      and ${appendSpecialtyMatchSql()}`;

  if (dedupeMapsUrl) {
    return `((${identityMatch}) or d.address_maps_link = v.address_maps_link)`;
  }

  return `(${identityMatch})`;
}

function buildAppendMigration(entries, sourceLabel, dedupeMapsUrl) {
  const valueLines = entries.map((entry) => {
    const phoneSql = entry.phone ? sqlLiteral(entry.phone) : "null";
    const latSql = entry.latitude === null ? "null" : String(entry.latitude);
    const lonSql = entry.longitude === null ? "null" : String(entry.longitude);

    return `    (${sqlLiteral(entry.name)}, ${sqlLiteral(entry.specialty)}, ${sqlLiteral(entry.district)}, ${sqlLiteral(entry.address_maps_link)}, ${phoneSql}, ${latSql}, ${lonSql}, ${sqlLiteral(entry.slug)})`;
  });

  return `-- Append manual directory rows from spreadsheet (${sourceLabel}).

alter table public.directory_manual
  add column if not exists phone text;

alter table public.directory_manual
  add column if not exists slug text;

insert into public.directory_manual (
  name,
  specialty,
  district,
  address_maps_link,
  phone,
  latitude,
  longitude,
  slug
)
select
  v.name,
  v.specialty,
  v.district::public.cyprus_district,
  v.address_maps_link,
  v.phone,
  v.latitude,
  v.longitude,
  v.slug
from (
  values
${valueLines.join(",\n")}
) as v(name, specialty, district, address_maps_link, phone, latitude, longitude, slug)
where not exists (
  select 1
  from public.directory_manual d
  where d.is_archived = false
    and ${buildAppendExistsClause(dedupeMapsUrl)}
);
`;
}

function summarizeSpecialties(entries) {
  const counts = new Map();
  for (const entry of entries) {
    counts.set(entry.specialty, (counts.get(entry.specialty) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

const { mode, dedupeMapsUrl, dedupeSpreadsheetPerson, normalizeNames, inputPath, outputPath } =
  parseArgs(process.argv.slice(2));
const sourceLabel = path.basename(inputPath);

if (!fs.existsSync(inputPath)) {
  throw new Error(`Input file not found: ${inputPath}`);
}

const workbook = xlsx.readFile(inputPath);
const sheetName = workbook.SheetNames[0];
const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

const entries = [];
const seenPeople = new Set();
const seenMapsLinks = dedupeMapsUrl ? new Set() : null;
let skippedDuplicateMaps = 0;
let skippedDuplicatePerson = 0;
let skippedClinicStyleNames = 0;
let skippedNormalizedNames = 0;

for (const [index, row] of rows.entries()) {
  const rawName = String(pickField(row, ["name"]) ?? "").trim();
  const district = String(pickField(row, ["district"])).trim();
  const specialtyRaw = pickField(row, ["specialty", "speciality"]);
  const mapsLink = String(
    pickField(row, ["google_maps_url", "address_maps_link", "maps_url", "google_maps_link"]),
  ).trim();
  const latitude = parseNumber(pickField(row, ["latitude", "lat"]));
  const longitude = parseNumber(pickField(row, ["longitude", "lon", "lng"]));
  const phone = normalizePhone(pickField(row, ["phone", "telephone", "tel"]));

  if (!rawName && !district && !mapsLink && !specialtyRaw) {
    continue;
  }

  let name = normalizeNames
    ? cleanManualDirectoryPersonName(rawName)
    : formatPersonName(rawName);

  if (normalizeNames && !name) {
    skippedNormalizedNames += 1;
    console.warn(`Skipping non-person / unparseable name (row ${index + 2}): ${rawName}`);
    continue;
  }

  if (!name || !district || !mapsLink || !specialtyRaw) {
    throw new Error(`Invalid row ${index + 2}: ${JSON.stringify(row)}`);
  }
  if (!normalizeNames && isClinicStyleName(name)) {
    skippedClinicStyleNames += 1;
    console.warn(`Skipping clinic-style name (row ${index + 2}): ${name}`);
    continue;
  }
  if (!VALID_DISTRICTS.has(district)) {
    throw new Error(`Invalid district "${district}" for ${name} (row ${index + 2})`);
  }

  const specialty = normalizeSpecialty(specialtyRaw);

  if (dedupeMapsUrl && seenMapsLinks.has(mapsLink)) {
    skippedDuplicateMaps += 1;
    continue;
  }

  if (dedupeSpreadsheetPerson) {
    const personKey = personDedupeKey(name, district, phone);
    if (phone && seenPeople.has(personKey)) {
      skippedDuplicatePerson += 1;
      continue;
    }
    if (phone) {
      seenPeople.add(personKey);
    }
  }

  if (dedupeMapsUrl) {
    seenMapsLinks.add(mapsLink);
  }

  entries.push({
    name,
    specialty,
    district,
    address_maps_link: mapsLink,
    phone,
    latitude,
    longitude,
  });
}

if (entries.length === 0) {
  throw new Error("No valid rows found in spreadsheet.");
}

entries.sort((a, b) => {
  const district = a.district.localeCompare(b.district);
  if (district !== 0) return district;
  const specialty = a.specialty.localeCompare(b.specialty);
  if (specialty !== 0) return specialty;
  return a.name.localeCompare(b.name);
});

assignImportSlugs(entries, { preferDistrictSuffix: mode === "append" });

const sql =
  mode === "append"
    ? buildAppendMigration(entries, sourceLabel, dedupeMapsUrl)
    : buildReplaceMigration(entries, sourceLabel);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, sql, "utf8");

console.log(`Wrote ${entries.length} rows to ${outputPath}`);
console.log(`Mode: ${mode}`);
console.log(`Dedupe maps URL (spreadsheet + SQL): ${dedupeMapsUrl}`);
console.log(`Dedupe spreadsheet person (name + district + phone): ${dedupeSpreadsheetPerson}`);
console.log(`Normalize names: ${normalizeNames}`);
console.log("Specialties:");
for (const [specialty, count] of summarizeSpecialties(entries)) {
  console.log(`  - ${specialty}: ${count}`);
}
if (skippedDuplicateMaps > 0) {
  console.log(`Skipped ${skippedDuplicateMaps} duplicate google_maps_url row(s).`);
}
if (skippedDuplicatePerson > 0) {
  console.log(
    `Skipped ${skippedDuplicatePerson} duplicate person row(s) (same name + district + phone).`,
  );
}
if (skippedClinicStyleNames > 0) {
  console.log(`Skipped ${skippedClinicStyleNames} clinic-style name row(s).`);
}
if (skippedNormalizedNames > 0) {
  console.log(`Skipped ${skippedNormalizedNames} non-person / unparseable name row(s).`);
}
