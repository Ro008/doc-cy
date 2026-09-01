/**
 * Generate SQL to backfill directory_manual.slug for all active rows.
 *
 * Usage:
 *   node scripts/backfill-manual-directory-slugs.mjs
 *   node scripts/backfill-manual-directory-slugs.mjs --write-migration
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 * (e.g. from .env.local). Writes migration to
 * supabase/migrations/20260714120100_backfill_directory_manual_slugs.sql
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const MAX_SLUG_LENGTH = 60;

function loadEnvLocal() {
  const envPath = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

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

const DISTRICT_SLUG = {
  Nicosia: "nicosia",
  Limassol: "limassol",
  Paphos: "paphos",
  Larnaca: "larnaca",
  Famagusta: "famagusta",
};

function buildManualDirectorySlugCandidates({ name, district, manualId }) {
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

  push(base);
  if (district && DISTRICT_SLUG[district]) {
    push(`${base}-${DISTRICT_SLUG[district]}`);
  }
  for (let suffix = 2; suffix <= 200; suffix += 1) {
    push(`${base}-${suffix}`);
  }
  if (manualId) {
    push(`${base}-${manualId.replace(/-/g, "").slice(0, 8)}`);
  }
  return candidates;
}

function pickFirstAvailableSlug(taken, candidates) {
  for (const candidate of candidates) {
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return null;
}

function sqlLiteral(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

async function main() {
  loadEnvLocal();
  const writeMigration = process.argv.includes("--write-migration");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRole) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in .env.local)",
    );
  }

  const { createClient } = require("@supabase/supabase-js");
  const admin = createClient(supabaseUrl, serviceRole);

  async function fetchAll(buildQuery) {
    const all = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const to = from + pageSize - 1;
      const { data, error } = await buildQuery().range(from, to);
      if (error) return { data: null, error };
      all.push(...(data ?? []));
      if (!data || data.length < pageSize) return { data: all, error: null };
    }
  }

  const [manualRes, doctorsRes] = await Promise.all([
    fetchAll(() =>
      admin
        .from("directory_manual")
        .select("id, name, district, slug")
        .eq("is_archived", false)
        .order("name", { ascending: true }),
    ),
    fetchAll(() => admin.from("professionals").select("slug").not("slug", "is", null)),
  ]);

  if (manualRes.error) {
    throw new Error(`Failed loading directory_manual: ${manualRes.error.message}`);
  }
  if (doctorsRes.error) {
    throw new Error(`Failed loading doctors slugs: ${doctorsRes.error.message}`);
  }

  const taken = new Set();
  for (const row of doctorsRes.data ?? []) {
    const slug = String(row.slug ?? "").trim().toLowerCase();
    if (slug) taken.add(slug);
  }

  const assignments = [];
  for (const row of manualRes.data ?? []) {
    const existing = String(row.slug ?? "").trim();
    if (existing) {
      taken.add(existing.toLowerCase());
      continue;
    }

    const slug = pickFirstAvailableSlug(
      taken,
      buildManualDirectorySlugCandidates({
        name: String(row.name ?? ""),
        district: String(row.district ?? ""),
        manualId: String(row.id ?? ""),
      }),
    );

    if (!slug) {
      throw new Error(`Could not allocate slug for manual row ${row.id} (${row.name})`);
    }

    taken.add(slug.toLowerCase());
    assignments.push({ id: row.id, name: row.name, slug });
  }

  console.log(`Allocated ${assignments.length} slug(s) for manual directory rows.`);

  if (assignments.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  const updateLines = assignments.map(
    (a) =>
      `update public.directory_manual set slug = ${sqlLiteral(a.slug)} where id = ${sqlLiteral(a.id)}::uuid;`,
  );

  const migrationSql = `-- Backfill directory_manual.slug for public landing pages (/finder/doctor/[slug]).
-- Generated by scripts/backfill-manual-directory-slugs.mjs

${updateLines.join("\n")}
`;

  if (writeMigration) {
    const outPath = path.join(
      repoRoot,
      "supabase",
      "migrations",
      "20260714120100_backfill_directory_manual_slugs.sql",
    );
    fs.writeFileSync(outPath, migrationSql, "utf8");
    console.log(`Wrote ${outPath}`);
    return;
  }

  for (const a of assignments) {
    const { error } = await admin
      .from("directory_manual")
      .update({ slug: a.slug })
      .eq("id", a.id);
    if (error) {
      throw new Error(`Failed updating ${a.name}: ${error.message}`);
    }
  }

  const savvas = assignments.find((a) => a.slug.includes("savvas-themistocleous"));
  if (savvas) {
    console.log(`Savvas pilot slug: ${savvas.slug}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
