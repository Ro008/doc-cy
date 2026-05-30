/**
 * List verified test doctors in production (no secrets beyond Supabase keys).
 *   node scripts/list-prod-test-doctors.mjs --env-file .env.production.local
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  const envPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(envPath)) {
    console.error("Missing env file:", envPath);
    process.exit(1);
  }
  dotenv.config({ path: envPath, override: true });
}

async function main() {
  const file = process.argv.includes("--env-file")
    ? process.argv[process.argv.indexOf("--env-file") + 1]
    : ".env.production.local";
  loadEnv(file);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !serviceRole) {
    console.error("Missing Supabase URL or service role in env file.");
    process.exit(1);
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: doctors, error } = await admin
    .from("doctors")
    .select("id, slug, email, status, is_test_profile, auth_user_id")
    .or("is_test_profile.eq.true,email.ilike.%@test-doccy.com.cy%,email.ilike.%rociosirvent%")
    .order("slug");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`Found ${doctors?.length ?? 0} candidate smoke doctors:\n`);
  for (const d of doctors ?? []) {
    const settings = await admin
      .from("doctor_settings")
      .select("pause_online_bookings, holiday_mode_enabled, booking_horizon_days")
      .eq("doctor_id", d.id)
      .maybeSingle();
    const s = settings.data;
    const flags = [
      d.status !== "verified" ? "NOT_VERIFIED" : null,
      s?.pause_online_bookings ? "PAUSED" : null,
      s?.holiday_mode_enabled ? "HOLIDAY" : null,
      !d.auth_user_id ? "NO_AUTH_LINK" : null,
    ]
      .filter(Boolean)
      .join(", ");
    console.log(
      `- ${d.slug} | ${d.email} | status=${d.status} | test=${d.is_test_profile}${flags ? ` | ${flags}` : ""}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
