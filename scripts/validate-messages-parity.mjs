#!/usr/bin/env node
/**
 * Ensures messages/el.json mirrors messages/en.json for every string leaf:
 * - Identical key paths (avoids next-intl showing raw paths for missing keys)
 * - No empty Greek where English has non-empty text
 * - Values must not contain `Namespace.` patterns for known top-level message roots
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @param {unknown} obj */
function collectLeafPaths(obj, prefix = "") {
  /** @type {Array<{ path: string; value: string }>} */
  const out = [];
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      out.push({ path: p, value: v });
    } else if (v && typeof v === "object") {
      out.push(...collectLeafPaths(v, p));
    }
  }
  return out;
}

const en = JSON.parse(readFileSync(join(root, "messages/en.json"), "utf8"));
const el = JSON.parse(readFileSync(join(root, "messages/el.json"), "utf8"));

/** Namespaces intentionally present only in en.json (not translated yet). */
const EN_ONLY_NAMESPACES = new Set(["PracticeInsights"]);

const topLevelNamespaces = Object.keys(en).sort();
for (const ns of Object.keys(el)) {
  if (!Object.prototype.hasOwnProperty.call(en, ns)) {
    console.error(`el.json has top-level namespace "${ns}" not present in en.json.`);
    process.exit(1);
  }
}
for (const ns of topLevelNamespaces) {
  if (EN_ONLY_NAMESPACES.has(ns)) continue;
  if (!Object.prototype.hasOwnProperty.call(el, ns)) {
    console.error(`Missing top-level namespace "${ns}" in el.json.`);
    process.exit(1);
  }
}

const enLeaves = collectLeafPaths(en);
const elLeaves = collectLeafPaths(el);
const enKeys = new Set(enLeaves.map((x) => x.path));
const elKeys = new Set(elLeaves.map((x) => x.path));

function isEnOnlyPath(path) {
  return EN_ONLY_NAMESPACES.has(path.split(".")[0]);
}

const missingInEl = [...enKeys]
  .filter((k) => !elKeys.has(k) && !isEnOnlyPath(k))
  .sort();
const extraInEl = [...elKeys].filter((k) => !enKeys.has(k)).sort();

if (missingInEl.length || extraInEl.length) {
  console.error("Message key mismatch between en.json and el.json:");
  if (missingInEl.length) console.error("\nMissing in el.json:\n", missingInEl.join("\n"));
  if (extraInEl.length) console.error("\nExtra in el.json:\n", extraInEl.join("\n"));
  process.exit(1);
}

const enByPath = Object.fromEntries(enLeaves.map((x) => [x.path, x.value]));

/** e.g. `BookingPage.errors.selectTimeSlot` leaked into UI */
function valueLooksLikeRawKeyPath(value, namespaces) {
  const t = value.trim();
  if (!t.includes(".")) return false;
  return namespaces.some((ns) => t.includes(`${ns}.`));
}

for (const { path, value } of elLeaves) {
  const enVal = enByPath[path];
  if (enVal !== undefined && enVal.trim() !== "" && value.trim() === "") {
    console.error(`Empty el value for "${path}" but en has text.`);
    process.exit(1);
  }
  if (valueLooksLikeRawKeyPath(value, topLevelNamespaces)) {
    console.error(
      `Value for "${path}" looks like a raw i18n key path: ${JSON.stringify(value)}`
    );
    process.exit(1);
  }
}

console.log(
  `OK: messages — ${elLeaves.length} string keys aligned in en.json / el.json (${topLevelNamespaces.length} namespaces).`
);
