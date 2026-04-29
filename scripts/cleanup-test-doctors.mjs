import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ENV_FILE = ".env.testing.local";
const TEST_EMAIL_SUFFIXES = ["@integration.test", "@test-doccy.com.cy"];
const TEST_NAME_PREFIXES = [
  "Booking Flow Doctor ",
  "Finder Card ",
  "Finder UX ",
  "Finder Filter ",
];
const TEST_SLUG_PREFIXES = ["booking-flow-", "finder-card-", "finder-ux-", "finder-filter-"];
const DEFAULT_PRESERVED_SLUGS = [
  "andreas-nikos",
  "kasia-petrova",
  "ross-geller",
  "tasos-smith",
];

function loadEnv() {
  const explicitEnv = process.env.PLAYWRIGHT_ENV_FILE?.trim();
  const envPath = explicitEnv
    ? path.resolve(process.cwd(), explicitEnv)
    : path.resolve(process.cwd(), DEFAULT_ENV_FILE);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

function normalizeUrl(u) {
  return String(u ?? "").trim().replace(/\/+$/, "");
}

function parseArgs(argv) {
  const flags = new Set(argv.slice(2));
  return {
    dryRun: flags.has("--dry-run"),
    allowProd: flags.has("--allow-prod"),
  };
}

function parsePreservedSlugs() {
  const fromEnv = String(process.env.PRESERVE_TEST_DOCTOR_SLUGS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_PRESERVED_SLUGS, ...fromEnv]);
}

async function listAllAuthUsers(admin) {
  const all = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw new Error(`auth.admin.listUsers failed (page ${page}): ${error.message}`);
    }
    const users = data?.users ?? [];
    all.push(...users);
    if (users.length < 200) break;
  }
  return all;
}

async function selectDoctors(admin) {
  const preservedSlugs = parsePreservedSlugs();
  const byEmail = [];
  for (const suffix of TEST_EMAIL_SUFFIXES) {
    const { data, error } = await admin
      .from("doctors")
      .select("id,auth_user_id,email,name,slug,is_test_profile")
      .ilike("email", `%${suffix}`);
    if (error) throw new Error(`Failed loading doctors by email suffix ${suffix}: ${error.message}`);
    byEmail.push(...(data ?? []));
  }

  const byName = [];
  for (const prefix of TEST_NAME_PREFIXES) {
    const { data, error } = await admin
      .from("doctors")
      .select("id,auth_user_id,email,name,slug,is_test_profile")
      .ilike("name", `${prefix}%`);
    if (error) throw new Error(`Failed loading doctors by name prefix ${prefix}: ${error.message}`);
    byName.push(...(data ?? []));
  }

  const bySlug = [];
  for (const prefix of TEST_SLUG_PREFIXES) {
    const { data, error } = await admin
      .from("doctors")
      .select("id,auth_user_id,email,name,slug,is_test_profile")
      .ilike("slug", `${prefix}%`);
    if (error) throw new Error(`Failed loading doctors by slug prefix ${prefix}: ${error.message}`);
    bySlug.push(...(data ?? []));
  }

  const unique = new Map();
  for (const row of [...byEmail, ...byName, ...bySlug]) {
    const slug = String(row.slug ?? "").trim().toLowerCase();
    if (slug && preservedSlugs.has(slug)) {
      continue;
    }
    unique.set(String(row.id), row);
  }
  return [...unique.values()];
}

async function main() {
  const args = parseArgs(process.argv);
  loadEnv();

  const supabaseUrl = normalizeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const prodSupabase = normalizeUrl(process.env.PROD_NEXT_PUBLIC_SUPABASE_URL);

  if (!supabaseUrl || !serviceRole) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  if (!args.allowProd && prodSupabase && supabaseUrl === prodSupabase) {
    throw new Error(
      "Refusing to run cleanup on production Supabase URL. Use --allow-prod only if you are absolutely sure."
    );
  }

  const admin = createClient(supabaseUrl, serviceRole);
  const doctors = await selectDoctors(admin);
  const doctorIds = doctors.map((d) => String(d.id));

  const authUserIds = new Set();
  for (const doctor of doctors) {
    if (doctor.auth_user_id) authUserIds.add(String(doctor.auth_user_id));
  }

  try {
    const allUsers = await listAllAuthUsers(admin);
    for (const user of allUsers) {
      const email = String(user.email ?? "").toLowerCase();
      if (TEST_EMAIL_SUFFIXES.some((suffix) => email.endsWith(suffix))) {
        authUserIds.add(String(user.id));
      }
    }
  } catch (error) {
    console.warn(
      `[cleanup-test-doctors] warning: failed listing auth users; continuing with doctor-linked users only (${String(
        error instanceof Error ? error.message : error
      )})`
    );
  }

  if (args.dryRun) {
    console.log(
      `[cleanup-test-doctors] dry-run doctors=${doctorIds.length} authUsers=${authUserIds.size} on ${supabaseUrl}`
    );
    return;
  }

  if (doctorIds.length > 0) {
    const { error } = await admin.from("doctors").delete().in("id", doctorIds);
    if (error) throw new Error(`Failed deleting doctors: ${error.message}`);
  }

  for (const id of authUserIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && !String(error.message ?? "").toLowerCase().includes("not found")) {
      throw new Error(`Failed deleting auth user ${id}: ${error.message}`);
    }
  }

  console.log(`[cleanup-test-doctors] removed doctors=${doctorIds.length} authUsers=${authUserIds.size}`);
}

main().catch((err) => {
  console.error("[cleanup-test-doctors] failed:", err);
  process.exit(1);
});
