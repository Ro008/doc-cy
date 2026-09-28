// Creates the fixture doctor (login + andreas-nikos profile) on the local CI stack, after
// scripts/ci-db/load.mjs. The login gets a fresh random password each run; it is written as
// step outputs (masked in the log) for the Playwright steps' TEST_USER_EMAIL / TEST_USER_PASSWORD.
//
//   node scripts/ci-db/fixtures.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { psqlLocal, supabase } from "./cli.mjs";
import { FIXTURE_DOCTOR, generateFixturePassword } from "./fixtures-lib.mjs";
import { assertLocalDbUrl } from "./load-lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const status = JSON.parse(supabase(["status", "-o", "json"], { cwd: repoRoot }).match(/\{[\s\S]*\}\s*$/)[0]);
assertLocalDbUrl(status.API_URL);

const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const password = generateFixturePassword();
const { data, error } = await admin.auth.admin.createUser({
  email: FIXTURE_DOCTOR.email,
  password,
  email_confirm: true,
});
if (error) throw new Error(`Creating the fixture login failed: ${error.message}`);

psqlLocal(fs.readFileSync(path.join(repoRoot, "supabase", "ci", "fixtures.sql"), "utf8"), "supabase/ci/fixtures.sql", {
  auth_user_id: data.user.id,
  name: FIXTURE_DOCTOR.name,
  slug: FIXTURE_DOCTOR.slug,
  email: FIXTURE_DOCTOR.email,
  specialty: FIXTURE_DOCTOR.specialty,
  languages: `{${FIXTURE_DOCTOR.languages.join(",")}}`,
});
console.error(`Created fixture doctor ${FIXTURE_DOCTOR.slug} (${FIXTURE_DOCTOR.email}).`);

if (process.env.GITHUB_OUTPUT) {
  console.log(`::add-mask::${password}`);
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `test_user_email=${FIXTURE_DOCTOR.email}\ntest_user_password=${password}\n`,
  );
} else {
  console.log(`TEST_USER_EMAIL=${FIXTURE_DOCTOR.email}\nTEST_USER_PASSWORD=${password}`);
}
