/**
 * End-to-end local demo: pending doctor → internal verify → Resend email.
 *
 * Usage:
 *   node scripts/demo-doctor-verification-email.mjs
 *   node scripts/demo-doctor-verification-email.mjs --email rociosirvent+testingdocverification@gmail.com
 *   node scripts/demo-doctor-verification-email.mjs --pause-before-verify   # browse /agenda/account-review first
 *   node scripts/demo-doctor-verification-email.mjs --cleanup-only
 *
 * Requires: dev server on --base-url (default http://localhost:3000), RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_EMAIL = "rociosirvent+testingdocverification@gmail.com";
const DEMO_PASSWORD = "DocVerifyDemo123!";
const DEMO_NAME = "Ro Verification Demo";

function parseArgs(argv) {
  const out = {
    email: DEFAULT_EMAIL,
    envFile: ".env.local",
    baseUrl: "http://localhost:3000",
    pauseBeforeVerify: false,
    cleanupOnly: false,
    keep: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--email" && argv[i + 1]) out.email = argv[++i].trim().toLowerCase();
    else if (a === "--env-file" && argv[i + 1]) out.envFile = argv[++i];
    else if (a === "--base-url" && argv[i + 1]) out.baseUrl = argv[++i].replace(/\/$/, "");
    else if (a === "--pause-before-verify") out.pauseBeforeVerify = true;
    else if (a === "--cleanup-only") out.cleanupOnly = true;
    else if (a === "--keep") out.keep = true;
  }
  return out;
}

function loadEnv(envFile) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (!fs.existsSync(envPath)) {
    console.error(`Env file not found: ${envPath}`);
    process.exit(1);
  }
  dotenv.config({ path: envPath, override: true });
  return envPath;
}

async function findAuthUserIdByEmail(admin, email) {
  let page = 1;
  while (page <= 30) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const user = data.users.find((u) => u.email?.trim().toLowerCase() === email) ?? null;
    if (user) return user.id;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function cleanupByEmail(admin, email) {
  const { data: doctors } = await admin.from("doctors").select("id, auth_user_id").eq("email", email);
  const authIds = new Set();
  for (const row of doctors ?? []) {
    if (row.id) {
      await admin.from("doctor_services").delete().eq("doctor_id", row.id);
      await admin.from("doctor_settings").delete().eq("doctor_id", row.id);
      await admin.from("doctors").delete().eq("id", row.id);
    }
    if (row.auth_user_id) authIds.add(row.auth_user_id);
  }
  for (const authUserId of authIds) {
    await admin.auth.admin.deleteUser(authUserId);
  }
  if (authIds.size > 0) return;

  try {
    const authUserId = await findAuthUserIdByEmail(admin, email);
    if (authUserId) await admin.auth.admin.deleteUser(authUserId);
  } catch (err) {
    console.warn(
      "[DocCy demo] Could not list auth users for cleanup (orphan auth row may remain):",
      err instanceof Error ? err.message : err,
    );
  }
}

async function waitForServer(baseUrl, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${baseUrl}/login`, { redirect: "manual" });
      if (res.status < 500) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

async function promptEnter(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => {
    rl.question(`${message}\n`, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const envPath = loadEnv(args.envFile);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const internalSecret = process.env.INTERNAL_DIRECTORY_SECRET?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  if (!internalSecret) {
    console.error("Missing INTERNAL_DIRECTORY_SECRET.");
    process.exit(1);
  }
  if (!resendKey) {
    console.error("Missing RESEND_API_KEY — email will be skipped by the app.");
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n[DocCy demo] Using env: ${envPath}`);
  console.log(`[DocCy demo] Target email: ${args.email}`);

  console.log("[DocCy demo] Cleaning up previous demo rows (if any)…");
  await cleanupByEmail(admin, args.email);

  if (args.cleanupOnly) {
    console.log("[DocCy demo] Cleanup done.");
    return;
  }

  const nonce = `docverify-${Date.now()}`;
  const slug = `ro-verification-demo-${nonce}`;

  const createUserRes = await admin.auth.admin.createUser({
    email: args.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: DEMO_NAME, role: "doctor" },
  });
  if (createUserRes.error || !createUserRes.data.user?.id) {
    console.error("Failed to create auth user:", createUserRes.error?.message);
    process.exit(1);
  }
  const authUserId = createUserRes.data.user.id;

  const doctorInsert = await admin
    .from("doctors")
    .insert({
      auth_user_id: authUserId,
      name: DEMO_NAME,
      specialty: "General Practice",
      email: args.email,
      phone: "+35799111222",
      languages: ["English"],
      license_number: `DEMO-${nonce}`,
      license_file_url: `licenses/demo/${nonce}.pdf`,
      status: "pending",
      slug,
      is_specialty_approved: true,
      is_test_profile: true,
      subscription_tier: "standard",
      district: "Nicosia",
    })
    .select("id")
    .single();

  if (doctorInsert.error || !doctorInsert.data?.id) {
    await admin.auth.admin.deleteUser(authUserId);
    console.error("Failed to create doctor:", doctorInsert.error?.message);
    process.exit(1);
  }

  const doctorId = String(doctorInsert.data.id);
  console.log(`[DocCy demo] Created pending doctor id=${doctorId} slug=${slug}`);

  console.log(`\n--- Step 1: see "Account under review" (optional) ---`);
  console.log(`Open: ${args.baseUrl}/login?next=${encodeURIComponent("/agenda/account-review")}`);
  console.log(`Email:    ${args.email}`);
  console.log(`Password: ${DEMO_PASSWORD}`);

  console.log(`\n--- Step 2: founder verifies in internal directory (optional UI) ---`);
  console.log(`Open: ${args.baseUrl}/internal/directory`);
  console.log(`Gate password: value of INTERNAL_DIRECTORY_SECRET in ${args.envFile}`);
  console.log(`Find: "${DEMO_NAME}" → Verify license`);

  const serverOk = await waitForServer(args.baseUrl);
  if (!serverOk) {
    console.error(
      `\nDev server not reachable at ${args.baseUrl}. Start it with:\n  node scripts/dev-with-env.mjs ${args.envFile} 3000\n`,
    );
    process.exit(1);
  }

  if (args.pauseBeforeVerify) {
    await promptEnter("Press Enter when you are ready to call the verify API and send the email…");
  }

  console.log(`\n[DocCy demo] POST /api/internal/doctors/verification (verify)…`);
  const verifyRes = await fetch(`${args.baseUrl}/api/internal/doctors/verification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `doccy-internal-directory=${internalSecret}`,
    },
    body: JSON.stringify({ doctorId, action: "verify" }),
  });
  const verifyBody = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok) {
    console.error("Verification API failed:", verifyRes.status, verifyBody);
    process.exit(1);
  }
  console.log("[DocCy demo] Verified:", verifyBody);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  console.log(`\n--- Step 3: check your inbox ---`);
  console.log(`Look for: [DocCy] Your account is ready`);
  console.log(`To: ${args.email} (delivers to rociosirvent@gmail.com)`);
  console.log(`Login link in email uses NEXT_PUBLIC_SITE_URL → ${siteUrl.replace(/\/$/, "")}/login?next=%2Fagenda`);

  console.log(`\n--- Step 4: sign in as verified doctor ---`);
  console.log(`Open: ${args.baseUrl}/login?next=${encodeURIComponent("/agenda")}`);
  console.log(`Same credentials — you should land on /agenda (not account-review).`);

  if (!args.keep) {
    console.log(`\n[DocCy demo] Demo rows left in DB for manual browsing.`);
    console.log(`To remove later: node scripts/demo-doctor-verification-email.mjs --cleanup-only --email ${args.email}`);
  }

  console.log("\n[DocCy demo] Done.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
