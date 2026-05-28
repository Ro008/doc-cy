/**
 * Delete a doctor row and linked auth user by slug (testing cleanup).
 *
 * Usage:
 *   node scripts/delete-doctor-by-slug.mjs --slug kasia-petrova --env-file .env.production.local
 *
 * Production requires DOC_CY_CONFIRM_PROD=YES.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const PROD_REF = "oiwlztcduxojadbcxkil";

function parseArgs(argv) {
  const out = { slug: "", envFile: "" };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--slug" && argv[i + 1]) out.slug = argv[++i].trim();
    else if (a === "--env-file" && argv[i + 1]) out.envFile = argv[++i].trim();
  }
  return out;
}

function loadEnvFile(explicit) {
  const candidates = explicit
    ? [explicit]
    : [".env.production.local", ".env.local", ".env.testing.local"];
  for (const file of candidates) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: true });
      return file;
    }
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.slug) {
    console.error("Usage: node scripts/delete-doctor-by-slug.mjs --slug <slug> [--env-file path]");
    process.exit(1);
  }

  const loaded = loadEnvFile(args.envFile);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !serviceRole) {
    console.error("Missing Supabase env vars.");
    process.exit(1);
  }

  if (url.includes(PROD_REF) && process.env.DOC_CY_CONFIRM_PROD !== "YES") {
    console.error("Refusing prod delete without DOC_CY_CONFIRM_PROD=YES");
    process.exit(1);
  }

  const admin = createClient(url, serviceRole);
  const { data: doctor, error } = await admin
    .from("doctors")
    .select("id, auth_user_id, email, name")
    .eq("slug", args.slug)
    .maybeSingle();

  if (error) {
    console.error("Lookup failed:", error.message);
    process.exit(1);
  }
  if (!doctor) {
    console.log(`No doctor with slug ${args.slug} (nothing to delete).`);
    return;
  }

  const doctorId = doctor.id;
  const authUserId = doctor.auth_user_id;

  await admin.from("doctor_services").delete().eq("doctor_id", doctorId);
  await admin.from("doctor_settings").delete().eq("doctor_id", doctorId);
  await admin.from("appointments").delete().eq("doctor_id", doctorId);

  const delDoctor = await admin.from("doctors").delete().eq("id", doctorId);
  if (delDoctor.error) {
    console.error("Failed deleting doctor:", delDoctor.error.message);
    process.exit(1);
  }

  if (authUserId) {
    const delAuth = await admin.auth.admin.deleteUser(String(authUserId));
    if (delAuth.error) {
      console.warn("Doctor deleted but auth user delete failed:", delAuth.error.message);
    }
  }

  console.log(`Deleted doctor ${args.slug} (${doctor.name}, ${doctor.email}).`);
  if (loaded) console.log("Env:", loaded);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
