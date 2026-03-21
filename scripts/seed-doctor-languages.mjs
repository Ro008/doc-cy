/**
 * Sets languages to English + Greek for doctors matching "nikos" or "smith"
 * in name or slug. Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL.
 *
 * Usage (from project root):
 *   node scripts/seed-doctor-languages.mjs
 *
 * Loads .env.local if present (via dotenv).
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env.local") });
dotenv.config({ path: resolve(__dirname, "..", ".env") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const LANGUAGES = ["English", "Greek"];

async function patchMatching(substr) {
  const s = substr.toLowerCase();
  const { data: rows, error: qErr } = await supabase
    .from("doctors")
    .select("id, name, slug, languages")
    .or(`slug.ilike.%${s}%,name.ilike.%${s}%`);

  if (qErr) {
    console.error(`Query error (${substr}):`, qErr.message);
    return;
  }
  if (!rows?.length) {
    console.warn(`No doctor rows matched "${substr}" (slug or name).`);
    return;
  }
  for (const row of rows) {
    const { error: uErr } = await supabase
      .from("doctors")
      .update({ languages: LANGUAGES })
      .eq("id", row.id);
    if (uErr) {
      console.error(`Update failed for ${row.name} (${row.id}):`, uErr.message);
    } else {
      console.log(`Updated ${row.name} (${row.slug ?? "no slug"}) →`, LANGUAGES);
    }
  }
}

await patchMatching("nikos");
await patchMatching("smith");
console.log("Done.");
