/**
 * Export GeSY healthcare professionals to Excel (one row per clinic/location).
 *
 * Source: https://www.gesy.org.cy/pubapi/
 * Plan:   docs/gesy-directory-export.md
 *
 * Usage:
 *   node scripts/export-gesy-specialty-xlsx.mjs --segment "personal doctor" --specialty all
 *   node scripts/export-gesy-specialty-xlsx.mjs --specialty dermatology
 *   node scripts/export-gesy-specialty-xlsx.mjs --specialty dermatology --limit 5
 *   node scripts/export-gesy-specialty-xlsx.mjs --list-specialties
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { transliterateGreek } from "./lib/manual-directory-name-clean.mjs";

const require = createRequire(import.meta.url);
const xlsx = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "https://www.gesy.org.cy/pubapi";
const FETCH_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en",
  "User-Agent": "DocCyGeSYExport/1.0",
};

const DISTRICT_MAP = {
  NIC: "Nicosia",
  LI: "Limassol",
  LIM: "Limassol",
  LA: "Larnaca",
  LAR: "Larnaca",
  PA: "Paphos",
  PAF: "Paphos",
  PFO: "Paphos",
  FA: "Famagusta",
  FAM: "Famagusta",
};

const GENDER_MAP = {
  F: "Female",
  M: "Male",
};

const OFFICE_TYPE_TO_SEGMENT = {
  OFFPD: "PD",
  OFFOS: "OS",
  LAB: "LB",
  PHA: "PH",
  IS: "IS",
  AE: "AE",
  OFFNM: "NM",
  OFFAP: "AP",
  OFFDE: "DE",
  OFFAS: "AS",
};

/** GeSY segment codes → English labels (provider-search UI). */
const SEGMENT_LABELS = {
  PD: "Personal Doctor",
  OS: "Outpatient Specialist",
  IS: "Inpatient Services",
  AP: "Allied Health Professional",
  DE: "Dentist",
  LB: "Laboratory",
  PH: "Pharmacy",
  NM: "Nurse or Midwife",
  AE: "Accidents & Emergency Department",
  AS: "Associated Services",
};

const SEGMENT_ALIASES = {
  pd: "PD",
  personaldoctor: "PD",
  os: "OS",
  outpatientspecialist: "OS",
  is: "IS",
  inpatientservices: "IS",
  ap: "AP",
  alliedhealthprofessional: "AP",
  de: "DE",
  dentist: "DE",
  lb: "LB",
  laboratory: "LB",
  ph: "PH",
  pharmacy: "PH",
  nm: "NM",
  nurseormidwife: "NM",
  nursingmidwifery: "NM",
  ae: "AE",
  accidentsemergencydepartment: "AE",
  accidentandemergency: "AE",
};

/**
 * Legacy DocCy specialty → GeSY code filters (optional).
 * Excel `specialty` column always uses GeSY UI labels, not DocCy remaps.
 */
const SPECIALTY_EXPORTS = {
  dermatology: {
    slug: "dermatology",
    doccyLabel: "Dermatology",
    gesyCodes: ["D", "ISD", "AED"],
    aliases: ["derm", "dermatology", "dermatologie", "dermato-venereology"],
  },
};

const COLUMN_ORDER = [
  "ghs_code",
  "name",
  "name_raw",
  "specialty",
  "specialty_gesy_code",
  "segment",
  "clinic_name",
  "clinic_ghs_code",
  "district",
  "districts_all",
  "gender",
  "email",
  "phone",
  "address",
];

function loadSpecialtyLabels() {
  const labelsPath = path.join(__dirname, "lib", "gesy-specialty-labels.json");
  const raw = JSON.parse(fs.readFileSync(labelsPath, "utf8"));
  return new Map(Object.entries(raw));
}

function parseArgs(argv) {
  const args = {
    specialty: null,
    segment: null,
    limit: null,
    delayMs: 100,
    listSpecialties: false,
    output: null,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--specialty" && argv[i + 1]) args.specialty = argv[++i];
    else if (arg === "--segment" && argv[i + 1]) args.segment = argv[++i];
    else if (arg === "--limit" && argv[i + 1]) {
      args.limit = Math.max(1, Number.parseInt(argv[++i], 10) || 1);
    } else if (arg === "--delay-ms" && argv[i + 1]) {
      args.delayMs = Math.max(0, Number.parseInt(argv[++i], 10) || 0);
    } else if (arg === "--output" && argv[i + 1]) args.output = argv[++i];
    else if (arg === "--list-specialties") args.listSpecialties = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/export-gesy-specialty-xlsx.mjs --segment "personal doctor" --specialty all
  node scripts/export-gesy-specialty-xlsx.mjs --specialty dermatology

Options:
  --segment NAME       GeSY segment filter (e.g. "personal doctor", PD)
  --specialty NAME     "all" or a mapped specialty (e.g. dermatology)
  --limit N            Max professionals to expand (not max Excel rows)
  --delay-ms N         Pause between API calls (default: 100)
  --output PATH        Override output xlsx path
  --list-specialties   Print mapped DocCy specialty filters and exit
  --help               Show help

Output: one row per clinic/location under tmp/gesy-exports/
specialty column uses GeSY UI labels (no DocCy remapping).
`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function specialtyKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function resolveSegmentCode(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const key = specialtyKey(raw);
  if (SEGMENT_ALIASES[key]) return SEGMENT_ALIASES[key];
  const upper = String(raw).trim().toUpperCase();
  if (SEGMENT_LABELS[upper]) return upper;
  return null;
}

function resolveSpecialtyConfig(raw) {
  if (raw == null) return null;
  const key = specialtyKey(raw);
  if (!key || key === "all") return { kind: "all" };
  for (const config of Object.values(SPECIALTY_EXPORTS)) {
    const candidates = [config.slug, config.doccyLabel, ...(config.aliases || [])];
    if (candidates.some((c) => specialtyKey(c) === key)) {
      return { kind: "mapped", ...config };
    }
  }
  return null;
}

function defaultOutputSlug(segmentCode, specialtyConfig) {
  const segmentPart = segmentCode
    ? specialtyKey(SEGMENT_LABELS[segmentCode] || segmentCode).replace(/_/g, "-")
    : "all-segments";
  const specialtyPart =
    specialtyConfig?.kind === "all"
      ? "all-specialties"
      : specialtyConfig?.slug || "specialty";
  return `${segmentPart}-${specialtyPart}`;
}

async function fetchJson(urlPath) {
  const url = `${BASE}${urlPath}`;
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function toTitleCaseWords(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word === "&") return word;
      if (/^[A-Z0-9]{2,6}$/.test(word) || /^[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)+\.?$/.test(word)) {
        return word.toUpperCase();
      }
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

function hasLatinLetters(value) {
  return /[A-Za-z]/.test(String(value || ""));
}

function extractLatinName(pro) {
  const full = String(pro.name || "").trim();
  if (full.includes("/")) {
    const parts = full.split("/").map((p) => p.trim()).filter(Boolean);
    const latinPart = [...parts].reverse().find((p) => hasLatinLetters(p));
    if (latinPart) return latinPart;
  }
  if (hasLatinLetters(full)) return full;
  const first = String(pro.firstName || "").trim();
  const last = String(pro.lastName || "").trim();
  return `${first} ${last}`.trim() || full;
}

function displayName(pro) {
  return toTitleCaseWords(extractLatinName(pro));
}

function rawName(pro) {
  return extractLatinName(pro);
}

function latinizeText(value) {
  let s = String(value ?? "").trim();
  if (!s) return "";
  if (/[\u0370-\u03FF\u1F00-\u1FFF]/.test(s)) s = transliterateGreek(s);
  return s
    .replace(/[\u0370-\u03FF\u1F00-\u1FFF]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function latinizeClinicName(value) {
  return toTitleCaseWords(latinizeText(value));
}

function latinizeAddressText(value) {
  let s = String(value ?? "").trim();
  if (!s) return "";
  const phrases = [
    [/Αρ\.?\s*Διαμερίσματος/gi, "Flat"],
    [/Αριθμ(?:ός|ου)?\.?\s*Διαμερίσματος/gi, "Flat"],
    [/Διαμέρισμα(?:τος)?/gi, "Flat"],
    [/Όροφος/gi, "Floor"],
    [/ορόφ(?:ου|ο)/gi, "Floor"],
    [/Λεωφόρος/gi, "Avenue"],
    [/Λεωφ\./gi, "Ave."],
    [/Πλατεία/gi, "Square"],
    [/Κατάστημα/gi, "Shop"],
    [/Γραφείο/gi, "Office"],
    [/Οδός/gi, ""],
    [/Αρ\.\s*(?=\d)/gi, "No. "],
  ];
  for (const [re, rep] of phrases) s = s.replace(re, rep);
  return latinizeText(s)
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .trim();
}

function mapDistrictCodes(codes = []) {
  return codes.map((code) => DISTRICT_MAP[String(code).toUpperCase()] ?? code);
}

function primaryDistrict(codes = []) {
  for (const code of codes) {
    const mapped = DISTRICT_MAP[String(code).toUpperCase()];
    if (mapped) return mapped;
  }
  return "";
}

function districtFromOffice(addr, fallbackCodes = []) {
  const fromOffice =
    DISTRICT_MAP[String(addr?.districtCd || addr?.district || "").toUpperCase()] ||
    latinizeAddressText(addr?.district);
  return fromOffice || primaryDistrict(fallbackCodes) || "";
}

function digitsOnlyPhone(raw) {
  if (raw == null || raw === "") return "";
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("357") && digits.length > 8) digits = digits.slice(3);
  return digits;
}

function segmentLabel(code) {
  const key = String(code || "").toUpperCase();
  return SEGMENT_LABELS[key] || key;
}

function formatOfficeAddress(addr, fallbackDistrict) {
  if (!addr) return "";
  const districtLabel = districtFromOffice(addr, []) || fallbackDistrict || "";
  return [addr.address, addr.municip, addr.postCode, districtLabel]
    .map((part, idx) => (idx === 3 ? part : latinizeAddressText(part)))
    .filter(Boolean)
    .join(", ");
}

function officeMatchesSegments(entry, segments) {
  const seg = OFFICE_TYPE_TO_SEGMENT[entry?.address?.type];
  if (!seg) return true;
  return (segments || []).includes(seg);
}

function pickOfficeForClinic(offices, assocSegments, selfSegments, preferSegment) {
  const matching = offices.filter(
    (e) =>
      officeMatchesSegments(e, assocSegments) || officeMatchesSegments(e, selfSegments),
  );
  const pool = matching.length ? matching : offices;
  if (!pool.length) return null;

  if (preferSegment) {
    const preferredSeg = pool.find(
      (e) => OFFICE_TYPE_TO_SEGMENT[e.address?.type] === preferSegment,
    );
    if (preferredSeg) return preferredSeg;
  }

  return (
    pool.find((e) => {
      const seg = OFFICE_TYPE_TO_SEGMENT[e.address?.type];
      return seg && (assocSegments || []).includes(seg);
    }) ||
    pool.find((e) => String(e.address?.address || "").trim()) ||
    pool[0]
  );
}

function uniqueNonEmpty(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const v = String(value || "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/**
 * Specialty label as shown in GeSY UI language files / dropdowns.
 * For Personal Doctors, Specialty dropdown uses pdtypes (PD - Adults / Children).
 */
function formatSpecialty(pro, specialtyLabels, specialtyConfig) {
  const pdtypeLabels = uniqueNonEmpty(
    (pro.pdtypes || []).map((code) => specialtyLabels.get(String(code)) || ""),
  );
  if (pdtypeLabels.length) return pdtypeLabels.join("; ");

  const codes =
    specialtyConfig?.kind === "mapped"
      ? (pro.specialties || []).filter((code) =>
          specialtyConfig.gesyCodes.includes(String(code).toUpperCase()),
        )
      : pro.specialties || [];

  const labels = uniqueNonEmpty(
    codes.map((code) => specialtyLabels.get(String(code)) || String(code)),
  );
  return labels.join("; ");
}

function formatSpecialtyCodes(pro, specialtyConfig) {
  if (specialtyConfig?.kind === "mapped") {
    const matched = (pro.specialties || []).filter((code) =>
      specialtyConfig.gesyCodes.includes(String(code).toUpperCase()),
    );
    if (matched.length) return matched.join(";");
  }
  const codes = uniqueNonEmpty(pro.specialties || []);
  if (codes.length) return codes.join(";");
  return uniqueNonEmpty(pro.pdtypes || []).join(";");
}

/**
 * Expand one professional into one Excel row per associated clinic.
 */
async function expandProfessionalToClinicRows(pro, options) {
  const { specialtyConfig, specialtyLabels, delayMs, preferSegment } = options;
  const detail = await fetchJson(`/professional/${encodeURIComponent(pro.prvId)}`);
  if (delayMs) await sleep(delayMs);

  const selfSegments = detail.segments ?? pro.segments ?? [];
  const personDistrictCodes = pro.districts || detail.districts || [];
  const base = {
    ghs_code: pro.prvId || "",
    name: displayName(pro),
    name_raw: rawName(pro),
    specialty: formatSpecialty(pro, specialtyLabels, specialtyConfig),
    specialty_gesy_code: formatSpecialtyCodes(pro, specialtyConfig),
    districts_all: mapDistrictCodes(personDistrictCodes).join("; "),
    gender: GENDER_MAP[pro.genderCd] ?? pro.genderCd ?? "",
    email: pro.email ?? "",
  };

  const assocs = (detail.assocPrvs || []).filter(
    (a) => a?.prvId && a.prvId !== detail.prvId,
  );

  const targets = assocs.length
    ? assocs.map((a) => ({
        clinicName: a.name,
        clinicId: a.prvId,
        segments: a.segments ?? selfSegments,
      }))
    : [
        {
          clinicName: detail.name || pro.name || "",
          clinicId: detail.prvId,
          segments: selfSegments,
        },
      ];

  const rows = [];
  for (const target of targets) {
    const hours = await fetchJson(
      `/professional/${encodeURIComponent(target.clinicId)}/workhours`,
    );
    if (delayMs) await sleep(delayMs);

    const entry = pickOfficeForClinic(
      hours.addrWorkHours || [],
      target.segments,
      selfSegments,
      preferSegment,
    );
    const addr = entry?.address ?? {};
    const segCode =
      OFFICE_TYPE_TO_SEGMENT[addr.type] ||
      (preferSegment && (target.segments || []).includes(preferSegment)
        ? preferSegment
        : null) ||
      (target.segments || [])[0] ||
      (selfSegments || [])[0] ||
      "";
    const phone =
      digitsOnlyPhone(addr.mobPhone) ||
      digitsOnlyPhone(addr.workPhone) ||
      digitsOnlyPhone((pro.telephones || [])[0]);
    const district = districtFromOffice(addr, personDistrictCodes);

    rows.push({
      ...base,
      segment: segmentLabel(segCode),
      clinic_name: latinizeClinicName(target.clinicName),
      clinic_ghs_code: target.clinicId || "",
      district,
      phone,
      address: formatOfficeAddress(addr, district),
    });
  }

  return rows;
}

function writeXlsx(rows, outputPath) {
  const sheetRows = rows.map((row) => {
    const ordered = {};
    for (const key of COLUMN_ORDER) ordered[key] = row[key] ?? "";
    return ordered;
  });
  const workbook = xlsx.utils.book_new();
  const sheet = xlsx.utils.json_to_sheet(sheetRows, { header: COLUMN_ORDER });
  xlsx.utils.book_append_sheet(workbook, sheet, "professionals");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  xlsx.writeFile(workbook, outputPath);
}

async function main() {
  const args = parseArgs(process.argv);
  const specialtyLabels = loadSpecialtyLabels();

  if (args.help) {
    printHelp();
    return;
  }

  if (args.listSpecialties) {
    for (const config of Object.values(SPECIALTY_EXPORTS)) {
      console.log(
        `${config.doccyLabel} (${config.slug}) → GeSY codes: ${config.gesyCodes.join(", ")}`,
      );
    }
    console.log("all → no specialty filter (use with --segment)");
    return;
  }

  const segmentCode = resolveSegmentCode(args.segment);
  if (args.segment && !segmentCode) {
    console.error(`Unknown segment "${args.segment}".`);
    process.exitCode = 1;
    return;
  }

  const specialtyConfig = resolveSpecialtyConfig(args.specialty ?? (segmentCode ? "all" : null));
  if (!args.specialty && !segmentCode) {
    printHelp();
    process.exitCode = 1;
    return;
  }
  if (args.specialty && !specialtyConfig) {
    console.error(`Unknown specialty "${args.specialty}".`);
    process.exitCode = 1;
    return;
  }

  console.log("Fetching GeSY professionals list…");
  const list = await fetchJson("/professionals");
  if (!Array.isArray(list)) throw new Error("Unexpected /professionals response");

  let matches = list.filter((pro) => {
    if (segmentCode && !(pro.segments || []).includes(segmentCode)) return false;
    if (specialtyConfig?.kind === "mapped") {
      const codeSet = new Set(specialtyConfig.gesyCodes.map((c) => c.toUpperCase()));
      return (pro.specialties || []).some((code) => codeSet.has(String(code).toUpperCase()));
    }
    return true;
  });

  matches.sort((a, b) =>
    extractLatinName(a).localeCompare(extractLatinName(b), "en", { sensitivity: "base" }),
  );

  const specialtyDesc =
    specialtyConfig?.kind === "all"
      ? "all specialties"
      : `${specialtyConfig.doccyLabel} (codes: ${specialtyConfig.gesyCodes.join(", ")})`;
  const segmentDesc = segmentCode
    ? SEGMENT_LABELS[segmentCode] || segmentCode
    : "all segments";

  console.log(
    `Matched ${matches.length} professionals for segment=${segmentDesc}, specialty=${specialtyDesc} out of ${list.length} total.`,
  );

  if (args.limit != null) {
    matches = matches.slice(0, args.limit);
    console.log(`Applying --limit ${args.limit} → ${matches.length} professionals.`);
  }

  const rows = [];
  const started = Date.now();
  for (let i = 0; i < matches.length; i++) {
    const pro = matches[i];
    try {
      const clinicRows = await expandProfessionalToClinicRows(pro, {
        specialtyConfig,
        specialtyLabels,
        delayMs: args.delayMs,
        preferSegment: segmentCode,
      });
      rows.push(...clinicRows);
    } catch (err) {
      console.warn(`  warn ${pro.prvId}: ${err.message}`);
    }
    if ((i + 1) % 25 === 0 || i === matches.length - 1) {
      const elapsedMin = ((Date.now() - started) / 60000).toFixed(1);
      console.log(
        `  expanded ${i + 1}/${matches.length} professionals → ${rows.length} clinic rows (${elapsedMin} min)`,
      );
    }
  }

  const slug = defaultOutputSlug(segmentCode, specialtyConfig);
  const outputPath =
    args.output || path.join(process.cwd(), "tmp", "gesy-exports", `${slug}.xlsx`);
  writeXlsx(rows, outputPath);

  const people = new Set(rows.map((r) => r.ghs_code)).size;
  console.log(`\nWrote ${rows.length} clinic rows (${people} professionals) → ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
