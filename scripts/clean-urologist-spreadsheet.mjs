/**
 * One-off cleaner for new_toUPLOAD_urologist.xlsx — writes a cleaned copy + JSON report.
 * Run: node scripts/clean-urologist-spreadsheet.mjs [input.xlsx] [output.xlsx]
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const xlsx = require("xlsx");

const inputPath =
  process.argv[2] ??
  path.join(process.env.USERPROFILE ?? "", "Downloads", "new_toUPLOAD_urologist.xlsx");
const outputPath =
  process.argv[3] ??
  path.join(process.env.USERPROFILE ?? "", "Downloads", "new_toUPLOAD_urologist_CLEANED.xlsx");
const reportPath = outputPath.replace(/\.xlsx$/i, "_report.json");

/** Exact raw-name fixes (surname-first → given-name-first). */
const EXACT_NAME_OVERRIDES = new Map([
  ["Kesidis Giannis", "Giannis Kesidis"],
  ["Adamou Vasileios", "Vasileios Adamou"],
  ["Papazoglou Ioannis", "Ioannis Papazoglou"],
  ["Kounounis Michalis", "Michalis Kounounis"],
  ["Adamopoulos Vasileios", "Vasileios Adamopoulos"],
  ["Kadis Savvas", "Savvas Kadis"],
  ["Pedonomou Marios", "Marios Pedonomou"],
  ["Tzagidis Grigorios", "Grigorios Tzagidis"],
  ["Perikleous Stefanos", "Stefanos Perikleous"],
  ["Irakleous Floros", "Floros Irakleous"],
  ["Kyriakides Yerasimos", "Yerasimos Kyriakides"],
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

function cleanUrologistName(rawName) {
  const collapsed = collapseWs(rawName);
  if (!collapsed) return { cleaned: null, action: "empty" };
  if (isClinicStyleName(collapsed)) return { cleaned: null, action: "skip_clinic" };

  if (EXACT_NAME_OVERRIDES.has(collapsed)) {
    return { cleaned: EXACT_NAME_OVERRIDES.get(collapsed), action: "override" };
  }

  const plain = toTitleCaseWords(collapsed);
  return {
    cleaned: plain,
    action: plain === collapsed ? "unchanged" : "title_case",
  };
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

const workbook = xlsx.readFile(inputPath);
const sheetName = workbook.SheetNames[0];
const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

const report = {
  source: path.basename(inputPath),
  output: path.basename(outputPath),
  totalRows: rows.length,
  keptRows: 0,
  specialtyNormalizedTo: "Urology",
  skippedClinic: [],
  nameChanges: [],
  unchangedNames: 0,
  noPhone: [],
  duplicateNamesInFile: [],
  byDistrict: {},
  notes: [
    "urologist → Urology",
    "Kept multi-district Adamou/Adamopoulos rows",
    "Left Vasilis Adamou vs Vasileios Adamou as separate spellings",
  ],
};

const cleanedRows = [];
const nameOccurrences = new Map();

for (const [index, row] of rows.entries()) {
  const rawName = collapseWs(pickField(row, ["name"]));
  const district = collapseWs(pickField(row, ["district"]));
  const phone = collapseWs(pickField(row, ["phone", "telephone", "tel"]));
  const mapsLink = collapseWs(
    pickField(row, ["google_maps_url", "address_maps_link", "maps_url", "google_maps_link"]),
  );

  if (!rawName && !district && !mapsLink) continue;

  const { cleaned, action } = cleanUrologistName(rawName);
  if (action === "skip_clinic") {
    report.skippedClinic.push({ row: index + 2, rawName, district });
    continue;
  }
  if (action === "empty" || !cleaned) continue;

  if (action === "unchanged") {
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
  let hasName = false;
  let hasSpecialty = false;
  for (const key of Object.keys(cleanedRow)) {
    const lower = key.trim().toLowerCase();
    if (lower === "name") {
      cleanedRow[key] = cleaned;
      hasName = true;
    }
    if (lower === "specialty" || lower === "speciality") {
      cleanedRow[key] = "Urology";
      hasSpecialty = true;
    }
  }
  if (!hasName) cleanedRow.name = cleaned;
  if (!hasSpecialty) cleanedRow.specialty = "Urology";

  cleanedRows.push(cleanedRow);

  const nameKey = cleaned.toLowerCase();
  if (!nameOccurrences.has(nameKey)) nameOccurrences.set(nameKey, []);
  nameOccurrences.get(nameKey).push({ row: index + 2, district, phone, mapsLink });
}

for (const [name, occ] of nameOccurrences) {
  if (occ.length > 1) report.duplicateNamesInFile.push({ name, occurrences: occ });
}

const outSheet = xlsx.utils.json_to_sheet(cleanedRows);
const outWb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(outWb, outSheet, sheetName);
xlsx.writeFile(outWb, outputPath);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

console.log(`Wrote ${report.keptRows} rows → ${outputPath}`);
console.log(`Report → ${reportPath}`);
console.log(`Name changes: ${report.nameChanges.length}`);
for (const change of report.nameChanges) {
  console.log(`  ${change.from} → ${change.to}`);
}
console.log(`Duplicate names: ${report.duplicateNamesInFile.length}`);
console.log(`No phone: ${report.noPhone.length}`);
