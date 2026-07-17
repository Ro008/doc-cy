/**
 * One-off cleaner for new_toUPLOAD_Gynecologist.xlsx — writes a cleaned copy + JSON report.
 * Run: node scripts/clean-gynecologist-spreadsheet.mjs [input.xlsx] [output.xlsx]
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { cleanManualDirectoryPersonName } from "./lib/manual-directory-name-clean.mjs";

const require = createRequire(import.meta.url);
const xlsx = require("xlsx");

const inputPath =
  process.argv[2] ??
  path.join(process.env.USERPROFILE ?? "", "Downloads", "new_toUPLOAD_Gynecologist.xlsx");
const outputPath =
  process.argv[3] ??
  path.join(process.env.USERPROFILE ?? "", "Downloads", "new_toUPLOAD_Gynecologist_CLEANED.xlsx");
const reportPath = outputPath.replace(/\.xlsx$/i, "_report.json");

/** Exact raw-name fixes (spreadsheet quirks). */
const EXACT_NAME_OVERRIDES = new Map([
  ["Spyridakis Chrysostomou", "Chrysostomou Spyridakis"],
  ["Kakoyiannis Stelios", "Stelios Kakoyiannis"],
  ["Mitas Georgios", "Georgios Mitas"],
  ["Koundouros Filippos", "Filippos Koundouros"],
  ["Sachnova Natalia", "Natalia Sachnova"],
  ["Alexandrou Evangelos", "Evangelos Alexandrou"],
  ["Anastasiou George", "George Anastasiou"],
  ["Akriola Fachiridou Maria", "Maria Akriola Fachiridou"],
]);

const COMMON_GIVEN_NAMES = new Set([
  "andreas",
  "andrea",
  "androula",
  "angeliki",
  "anastasis",
  "anastasios",
  "aris",
  "charalambos",
  "charis",
  "christalla",
  "christina",
  "christos",
  "dimitra",
  "dimitrios",
  "dionysis",
  "dionysios",
  "efterpi",
  "elena",
  "elli",
  "emine",
  "evangelia",
  "evangelos",
  "filippos",
  "fotis",
  "george",
  "georges",
  "georgios",
  "giorgos",
  "ilia",
  "inesa",
  "irina",
  "konstantinos",
  "kyriakos",
  "magia",
  "maria",
  "marios",
  "maro",
  "martha",
  "melina",
  "menelaos",
  "michalis",
  "minos",
  "natalia",
  "nicodemos",
  "nicolas",
  "niki",
  "nikoletta",
  "oleg",
  "olga",
  "panagiota",
  "panagiotis",
  "paris",
  "prokopis",
  "ria",
  "riana",
  "savvas",
  "simos",
  "stamatios",
  "stavros",
  "stelios",
  "tanos",
  "tatiana",
  "victoria",
]);

function collapseWs(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
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

function isClinicStyleName(name) {
  return /\b(center|centre|clinic|studio|hospital|medical centre|medical center|practice|group)\b/i.test(
    String(name ?? ""),
  );
}

function looksLikeSurnameFirst(twoWordName) {
  const [first, second] = collapseWs(twoWordName).split(" ");
  if (!first || !second) return false;
  const secondLower = second.toLowerCase();
  if (COMMON_GIVEN_NAMES.has(secondLower)) return true;
  // Greek genitive surname endings when given name is second token
  if (/^(ou|is|as|akis|idis|iadis|oglou|poulou|tzis|llis|llis)$/i.test(first.slice(-3))) {
    return COMMON_GIVEN_NAMES.has(secondLower);
  }
  return false;
}

function reorderSurnameFirst(rawName) {
  const collapsed = collapseWs(rawName);
  const words = collapsed.split(" ").filter(Boolean);
  if (words.length === 2 && looksLikeSurnameFirst(collapsed)) {
    return toTitleCaseWords(`${words[1]} ${words[0]}`);
  }
  if (words.length === 3 && COMMON_GIVEN_NAMES.has(words[2].toLowerCase())) {
    // e.g. Akriola Fachiridou Maria
    return toTitleCaseWords(`${words[2]} ${words[0]} ${words[1]}`);
  }
  return null;
}

function cleanGynecologistName(rawName) {
  const collapsed = collapseWs(rawName);
  if (!collapsed) return { cleaned: null, action: "empty" };
  if (isClinicStyleName(collapsed)) return { cleaned: null, action: "skip_clinic" };

  if (EXACT_NAME_OVERRIDES.has(collapsed)) {
    return {
      cleaned: EXACT_NAME_OVERRIDES.get(collapsed),
      action: "override",
    };
  }

  const reordered = reorderSurnameFirst(collapsed);
  if (reordered) {
    return { cleaned: reordered, action: "reordered_surname_first" };
  }

  const fromShared = cleanManualDirectoryPersonName(collapsed);
  if (fromShared) {
    return {
      cleaned: fromShared,
      action: fromShared !== toTitleCaseWords(collapsed) ? "shared_cleaner" : "unchanged",
    };
  }

  const plain = toTitleCaseWords(collapsed);
  return { cleaned: plain, action: "title_case_only" };
}

function pickField(row, keys) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [
    key.trim().toLowerCase(),
    value,
  ]);
  for (const wanted of keys) {
    const wantedKey = wanted.toLowerCase();
    const hit = normalizedEntries.find(([key]) => key === wantedKey);
    if (hit && String(hit[1] ?? "").trim() !== "") return hit[1];
  }
  return "";
}

function normalizePhone(value) {
  const trimmed = collapseWs(value);
  return trimmed.length > 0 ? trimmed : "";
}

const workbook = xlsx.readFile(inputPath);
const sheetName = workbook.SheetNames[0];
const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

const report = {
  source: path.basename(inputPath),
  output: path.basename(outputPath),
  totalRows: rows.length,
  keptRows: 0,
  skippedClinic: [],
  nameChanges: [],
  unchangedNames: 0,
  noPhone: [],
  duplicateNamesInFile: [],
  duplicateMapsUrlInFile: [],
  specialtyNormalizedTo: "Gynecology",
  byDistrict: {},
};

const cleanedRows = [];
const nameOccurrences = new Map();
const mapsOccurrences = new Map();

for (const [index, row] of rows.entries()) {
  const rawName = collapseWs(pickField(row, ["name"]));
  const district = collapseWs(pickField(row, ["district"]));
  const specialtyRaw = collapseWs(pickField(row, ["specialty", "speciality"]));
  const mapsLink = collapseWs(
    pickField(row, ["google_maps_url", "address_maps_link", "maps_url", "google_maps_link"]),
  );
  const phone = normalizePhone(pickField(row, ["phone", "telephone", "tel"]));
  const latitude = pickField(row, ["latitude", "lat"]);
  const longitude = pickField(row, ["longitude", "lon", "lng"]);

  if (!rawName && !district && !mapsLink) continue;

  const { cleaned, action } = cleanGynecologistName(rawName);
  if (action === "skip_clinic") {
    report.skippedClinic.push({ row: index + 2, rawName, district });
    continue;
  }

  if (action === "empty") continue;

  if (action === "unchanged" || action === "title_case_only") {
    report.unchangedNames += 1;
  } else {
    report.nameChanges.push({ row: index + 2, from: rawName, to: cleaned, action });
  }

  if (!phone) {
    report.noPhone.push({ row: index + 2, name: cleaned, district });
  }

  report.byDistrict[district] = (report.byDistrict[district] ?? 0) + 1;
  report.keptRows += 1;

  const cleanedRow = { ...row };
  for (const key of Object.keys(cleanedRow)) {
    if (key.trim().toLowerCase() === "name") cleanedRow[key] = cleaned;
    if (["specialty", "speciality"].includes(key.trim().toLowerCase())) {
      cleanedRow[key] = "Gynecology";
    }
  }
  if (!Object.keys(cleanedRow).some((k) => k.trim().toLowerCase() === "name")) {
    cleanedRow.name = cleaned;
  }
  cleanedRows.push(cleanedRow);

  const nameKey = cleaned.toLowerCase();
  if (!nameOccurrences.has(nameKey)) nameOccurrences.set(nameKey, []);
  nameOccurrences.get(nameKey).push({ row: index + 2, district, phone, mapsLink });

  if (!mapsOccurrences.has(mapsLink)) mapsOccurrences.set(mapsLink, []);
  mapsOccurrences.get(mapsLink).push({ row: index + 2, name: cleaned, district });
}

for (const [name, occ] of nameOccurrences) {
  if (occ.length > 1) report.duplicateNamesInFile.push({ name, occurrences: occ });
}
for (const [mapsLink, occ] of mapsOccurrences) {
  if (occ.length > 1) report.duplicateMapsUrlInFile.push({ mapsLink, occurrences: occ });
}

const outSheet = xlsx.utils.json_to_sheet(cleanedRows);
const outWb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(outWb, outSheet, sheetName);
xlsx.writeFile(outWb, outputPath);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

console.log(`Wrote ${report.keptRows} rows → ${outputPath}`);
console.log(`Report → ${reportPath}`);
console.log(`Name changes: ${report.nameChanges.length}`);
console.log(`Duplicate names: ${report.duplicateNamesInFile.length}`);
console.log(`No phone: ${report.noPhone.length}`);
