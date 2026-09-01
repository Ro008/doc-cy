/**
 * Repair doctor login: delete corrupt auth row by email, create fresh user, relink doctors row.
 *
 * Usage:
 *   node scripts/repair-doctor-auth.mjs --slug kasia-petrova --password "demo1234"
 *   node scripts/repair-doctor-auth.mjs --email user@example.com --slug my-slug --password "x" --env-file .env.production.local
 *
 * Production (oiwlztcduxojadbcxkil): set DOC_CY_CONFIRM_PROD=YES and prod keys in --env-file.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const PROD_REF = "oiwlztcduxojadbcxkil";

function parseArgs(argv) {
  const out = { slug: "", email: "", password: "", envFile: "" };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--slug" && argv[i + 1]) {
      out.slug = argv[++i];
    } else if (a === "--email" && argv[i + 1]) {
      out.email = argv[++i].trim().toLowerCase();
    } else if ((a === "--password" || a === "-p") && argv[i + 1]) {
      out.password = argv[++i];
    } else if (a === "--env-file" && argv[i + 1]) {
      out.envFile = argv[++i];
    }
  }
  return out;
}

function loadEnvFile(explicit) {
  const candidates = explicit
    ? [explicit]
    : [
        process.env.PLAYWRIGHT_ENV_FILE?.trim(),
        ".env.production.local",
        ".env.local",
        ".env.testing.local",
      ].filter(Boolean);

  for (const file of candidates) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: true });
      return file;
    }
  }
  return null;
}

async function deleteAuthByEmail(admin, email) {
  let page = 1;
  let userId = null;
  while (page <= 30 && !userId) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      return { ok: false, error: error.message, needsSql: true };
    }
    const user =
      data.users.find((u) => u.email?.trim().toLowerCase() === email) ?? null;
    if (user) userId = user.id;
    if (data.users.length < 200) break;
    page += 1;
  }

  if (!userId) {
    return { ok: true, userId: null, deleted: false };
  }

  const del = await admin.auth.admin.deleteUser(userId);
  if (del.error) {
    return { ok: false, error: del.error.message, needsSql: true, userId };
  }
  return { ok: true, userId, deleted: true };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.slug || !args.password) {
    console.error(
      "Usage: node scripts/repair-doctor-auth.mjs --slug <slug> --password <pass> [--email <email>] [--env-file .env.production.local]",
    );
    process.exit(1);
  }
  if (args.password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const loaded = loadEnvFile(args.envFile);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!url || !serviceRole || !anon) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    if (loaded) console.error(`Loaded: ${loaded}`);
    process.exit(1);
  }

  const isProd = url.includes(PROD_REF);
  if (isProd && process.env.DOC_CY_CONFIRM_PROD !== "YES") {
    console.error(
      "Refusing prod repair without DOC_CY_CONFIRM_PROD=YES",
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const pub = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const doctorRes = await admin
    .from("professionals")
    .select("id, email, auth_user_id")
    .eq("slug", args.slug)
    .maybeSingle();

  if (doctorRes.error || !doctorRes.data) {
    console.error("Doctor not found for slug:", args.slug, doctorRes.error?.message);
    process.exit(1);
  }

  const email =
    args.email ||
    String(doctorRes.data.email ?? "")
      .trim()
      .toLowerCase();
  if (!email) {
    console.error("No email on doctor row; pass --email explicitly.");
    process.exit(1);
  }

  console.log(`Project: ${url}`);
  console.log(`Doctor slug: ${args.slug} (${doctorRes.data.id})`);
  console.log(`Email: ${email}`);

  await admin
    .from("professionals")
    .update({ auth_user_id: null })
    .eq("id", doctorRes.data.id);

  const cleanup = await deleteAuthByEmail(admin, email);
  if (!cleanup.ok) {
    console.error("Admin deleteUser failed:", cleanup.error);
    console.error(
      "Run supabase/repair_auth_user_by_email.sql in Supabase SQL Editor for this project, then re-run this script.",
    );
    process.exit(1);
  }
  if (cleanup.deleted) {
    console.log("Deleted existing auth user:", cleanup.userId);
  }

  const created = await admin.auth.admin.createUser({
    email,
    password: args.password,
    email_confirm: true,
    user_metadata: { role: "doctor" },
  });
  if (created.error || !created.data.user?.id) {
    console.error("createUser failed:", created.error?.message);
    console.error(
      "If email is still stuck, run supabase/repair_auth_user_by_email.sql first.",
    );
    process.exit(1);
  }

  const uid = created.data.user.id;
  const link = await admin
    .from("professionals")
    .update({ auth_user_id: uid })
    .eq("id", doctorRes.data.id);
  if (link.error) {
    console.error("Failed linking doctor:", link.error.message);
    process.exit(1);
  }

  const signIn = await pub.auth.signInWithPassword({ email, password: args.password });
  if (signIn.error) {
    console.error("Sign-in verification failed:", signIn.error.message);
    process.exit(1);
  }

  console.log("Repair OK.");
  console.log("auth_user_id:", uid);
  console.log("Login with:");
  console.log("  Email:", email);
  console.log("  Password: (the value you passed to --password)");
  if (loaded) console.log("Env file:", loaded);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
