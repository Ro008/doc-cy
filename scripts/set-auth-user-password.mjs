/**
 * Set a Supabase Auth user's password (testing / local only).
 *
 * Usage:
 *   node scripts/set-auth-user-password.mjs <email> <new-password>
 *
 * Loads .env.local, then .env.testing.local. Requires:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const PROD_REF = "oiwlztcduxojadbcxkil";

function loadEnv() {
  const explicit = process.env.PLAYWRIGHT_ENV_FILE?.trim();
  const candidates = explicit
    ? [explicit]
    : [".env.local", ".env.testing.local"];
  for (const file of candidates) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      return file;
    }
  }
  return null;
}

function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3] ?? "";
  if (!email || !password) {
    console.error(
      "Usage: node scripts/set-auth-user-password.mjs <email> <new-password>",
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const loaded = loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !serviceRole) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
    if (loaded) console.error(`Loaded env from: ${loaded}`);
    process.exit(1);
  }

  if (url.includes(PROD_REF) && process.env.DOC_CY_CONFIRM_PROD !== "YES") {
    console.error(
      "Refusing to change passwords on production. Set DOC_CY_CONFIRM_PROD=YES to override.",
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  (async () => {
    let userId = null;

    const { data: doctorRow, error: doctorErr } = await admin
      .from("doctors")
      .select("auth_user_id")
      .ilike("email", email)
      .maybeSingle();

    if (!doctorErr && doctorRow?.auth_user_id) {
      userId = String(doctorRow.auth_user_id);
    }

    if (!userId) {
      let page = 1;
      while (page <= 20 && !userId) {
        const { data, error } = await admin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (error) {
          console.error("listUsers failed:", error.message);
          console.error(
            "Tip: ensure doctors.email matches auth.users for this account.",
          );
          process.exit(1);
        }
        const user =
          data.users.find((u) => u.email?.trim().toLowerCase() === email) ??
          null;
        if (user) userId = user.id;
        if (data.users.length < 200) break;
        page += 1;
      }
    }

    if (!userId) {
      console.error(`No auth user found for email: ${email}`);
      process.exit(1);
    }

    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      password,
    });
    if (updateErr) {
      console.error("updateUserById failed:", updateErr.message);
      process.exit(1);
    }

    console.log(`Password updated for ${email} (user id ${userId}).`);
    if (loaded) console.log(`Supabase project: ${url}`);
  })();
}

main();
