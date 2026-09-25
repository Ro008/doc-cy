/**
 * Invite a DocCy admin: creates their Supabase login through an invite email and
 * adds their `admin_users` row. The admin sets their own password from the email,
 * then enrols an authenticator app on first sign-in at /internal/sign-in.
 *
 * Usage:
 *   node scripts/invite-admin.mjs --email <email> --name "<name>" [--role founder|partner]
 *     [--env-file .env.testing.local] [--dry-run]
 *
 * Production needs DOC_CY_CONFIRM_PROD=YES and --env-file .env.production.local.
 * Admins need their own login: an email that already has an account (for example a
 * professional's) is refused. Use a separate address (a +alias works).
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { adminInviteRedirectUrl, parseAdminInviteArgs } from "./lib/admin-invite.mjs";

const PROD_REF = "oiwlztcduxojadbcxkil";

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function findAuthUserByEmail(admin, email) {
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const user = data.users.find((u) => u.email?.trim().toLowerCase() === email) ?? null;
    if (user) return user;
    if (data.users.length < 200) return null;
  }
  throw new Error("listUsers: too many pages; refusing to guess.");
}

async function main() {
  const parsed = parseAdminInviteArgs(process.argv.slice(2));
  if (!parsed.ok) {
    fail(
      `${parsed.error}\nUsage: node scripts/invite-admin.mjs --email <email> --name "<name>" [--role founder|partner] [--env-file <file>] [--dry-run]`,
    );
  }
  const { email, name, role, envFile, dryRun } = parsed.value;

  const envPath = path.resolve(process.cwd(), envFile);
  if (!fs.existsSync(envPath)) fail(`Env file not found: ${envFile}`);
  dotenv.config({ path: envPath });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !serviceRole) fail(`Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ${envFile}.`);
  if (url.includes(PROD_REF) && process.env.DOC_CY_CONFIRM_PROD !== "YES") {
    fail("Refusing to invite an admin on Production. Set DOC_CY_CONFIRM_PROD=YES to confirm.");
  }
  const redirectTo = adminInviteRedirectUrl(
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com",
  );

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existingAdmins, error: adminErr } = await admin
    .from("admin_users")
    .select("id, is_active")
    .ilike("email", email);
  if (adminErr) fail(`Reading admin_users failed: ${adminErr.message}`);
  if ((existingAdmins ?? []).length > 0) {
    fail(`${email} is already an admin (active: ${existingAdmins[0].is_active}).`);
  }

  const { data: professionals, error: proErr } = await admin
    .from("professionals")
    .select("id")
    .ilike("email", email)
    .limit(1);
  if (proErr) fail(`Reading professionals failed: ${proErr.message}`);
  if ((professionals ?? []).length > 0) {
    fail(`${email} belongs to a professional. Admins need their own login; use another address.`);
  }

  const existingUser = await findAuthUserByEmail(admin, email);
  if (existingUser) {
    fail(`${email} already has a login (${existingUser.id}). Admins need a new one; use another address.`);
  }

  console.log(`Project:  ${url}`);
  console.log(`Admin:    ${name} <${email}>, role ${role}`);
  console.log(`Redirect: ${redirectTo}`);
  if (dryRun) {
    console.log("Dry run: no invite sent, nothing written.");
    return;
  }

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { name, doccy_admin: true },
  });
  if (inviteErr || !invited?.user) fail(`Invite failed: ${inviteErr?.message ?? "no user returned"}`);
  const authUserId = invited.user.id;

  const { data: row, error: insertErr } = await admin
    .from("admin_users")
    .insert({ auth_user_id: authUserId, name, email, role })
    .select("id")
    .single();
  if (insertErr || !row) {
    // Undo the login this run just created, so a retry starts clean.
    const { error: undoErr } = await admin.auth.admin.deleteUser(authUserId);
    fail(
      `Adding the admin row failed: ${insertErr?.message ?? "no row"}.` +
        (undoErr
          ? ` Removing the new login ${authUserId} also failed (${undoErr.message}); remove it by hand.`
          : " The new login was removed; the invite email link will not work."),
    );
  }

  console.log(`Invited. Admin row ${row.id}, login ${authUserId}.`);
  console.log("They set a password from the email, then enrol an authenticator app at first sign-in.");
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
