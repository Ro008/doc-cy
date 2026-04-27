import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL_DOMAIN = "@test-doccy.com.cy";
const TEST_NAME_PREFIX = "Prod Smoke ";

function loadEnv() {
  const explicitEnv = process.env.PLAYWRIGHT_ENV_FILE?.trim();
  const envPath = explicitEnv
    ? path.resolve(process.cwd(), explicitEnv)
    : path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
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

async function listAllLicensePaths(admin, emailPrefix) {
  const folder = `licenses/${emailPrefix}`;
  const out = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const { data, error } = await admin.storage.from("doctor-verifications").list(folder, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) break;
    const chunk = (data ?? [])
      .filter((f) => f.name && !f.name.endsWith("/"))
      .map((f) => `${folder}/${f.name}`);
    out.push(...chunk);
    if ((data ?? []).length < limit) break;
    offset += limit;
  }
  return out;
}

async function main() {
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!supabaseUrl || !serviceRole) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const admin = createClient(supabaseUrl, serviceRole);

  const { data: byDomain, error: domainErr } = await admin
    .from("doctors")
    .select("id,auth_user_id,email,license_file_url,name")
    .ilike("email", `%${TEST_EMAIL_DOMAIN}`);
  if (domainErr) {
    throw new Error(`Failed loading doctors by test domain: ${domainErr.message}`);
  }

  const { data: byName, error: nameErr } = await admin
    .from("doctors")
    .select("id,auth_user_id,email,license_file_url,name")
    .ilike("name", `${TEST_NAME_PREFIX}%`);
  if (nameErr) {
    throw new Error(`Failed loading doctors by test name prefix: ${nameErr.message}`);
  }

  const doctorMap = new Map();
  for (const d of [...(byDomain ?? []), ...(byName ?? [])]) {
    doctorMap.set(d.id, d);
  }
  const doctors = [...doctorMap.values()];
  const doctorIds = doctors.map((d) => String(d.id));

  if (doctorIds.length > 0) {
    const { error: delDoctorsErr } = await admin.from("doctors").delete().in("id", doctorIds);
    if (delDoctorsErr) {
      throw new Error(`Failed deleting doctor rows: ${delDoctorsErr.message}`);
    }
  }

  const authUserIds = new Set();
  for (const d of doctors) {
    if (d.auth_user_id) authUserIds.add(String(d.auth_user_id));
  }

  const allUsers = await listAllAuthUsers(admin);
  for (const u of allUsers) {
    const email = String(u.email ?? "").toLowerCase();
    if (email.endsWith(TEST_EMAIL_DOMAIN)) {
      authUserIds.add(String(u.id));
    }
  }

  for (const id of authUserIds) {
    const { error: authDelErr } = await admin.auth.admin.deleteUser(id);
    if (authDelErr && !String(authDelErr.message ?? "").toLowerCase().includes("not found")) {
      throw new Error(`Failed deleting auth user ${id}: ${authDelErr.message}`);
    }
  }

  const explicitLicensePaths = doctors
    .map((d) => (d.license_file_url ? String(d.license_file_url) : ""))
    .filter(Boolean);
  if (explicitLicensePaths.length > 0) {
    await admin.storage.from("doctor-verifications").remove(explicitLicensePaths);
  }

  const emailPrefixes = new Set();
  for (const d of doctors) {
    const email = String(d.email ?? "").toLowerCase().trim();
    if (!email) continue;
    emailPrefixes.add(email.replace(/[^a-z0-9._-]/g, "-").slice(0, 80));
  }

  for (const prefix of emailPrefixes) {
    const extraPaths = await listAllLicensePaths(admin, prefix);
    if (extraPaths.length > 0) {
      await admin.storage.from("doctor-verifications").remove(extraPaths);
    }
  }

  for (const id of authUserIds) {
    const folder = `profiles/${id}`;
    const { data: files } = await admin.storage.from("avatars").list(folder, {
      limit: 200,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });
    const paths = (files ?? [])
      .filter((f) => f.name && !f.name.endsWith("/"))
      .map((f) => `${folder}/${f.name}`);
    if (paths.length > 0) {
      await admin.storage.from("avatars").remove(paths);
    }
  }

  console.log(
    `[cleanup-prod-smoke-registrations] doctors=${doctorIds.length} authUsers=${authUserIds.size} removed`
  );
}

main().catch((err) => {
  console.error("[cleanup-prod-smoke-registrations] failed:", err);
  process.exit(1);
});
