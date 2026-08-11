/**
 * One-shot: clean polluted directory_manual display names on testing (or given env).
 *
 *   node scripts/cleanup-gesy-directory-display-names.mjs --env-file .env.testing.local --dry-run
 *   node scripts/cleanup-gesy-directory-display-names.mjs --env-file .env.testing.local
 */
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { cleanGesyDirectoryDisplayName } from "./lib/gesy-directory-display-name.mjs";

function parseArgs(argv) {
  const out = { envFile: ".env.testing.local", dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--env-file") out.envFile = argv[++i] ?? out.envFile;
  }
  return out;
}

async function fetchAllNames(supabase) {
  const page = 1000;
  const all = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("directory_manual")
      .select("id, name")
      .eq("is_archived", false)
      .order("id")
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < page) break;
  }
  return all;
}

async function main() {
  const args = parseArgs(process.argv);
  loadEnv({ path: path.resolve(args.envFile) });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase URL/service role in", args.envFile);
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const rows = await fetchAllNames(supabase);
  const updates = [];
  for (const row of rows) {
    const before = String(row.name ?? "");
    const after = cleanGesyDirectoryDisplayName(before);
    if (!after || after === before) continue;
    updates.push({ id: row.id, before, after });
  }

  console.log(
    JSON.stringify(
      {
        envFile: args.envFile,
        dryRun: args.dryRun,
        scanned: rows.length,
        toUpdate: updates.length,
        sample: updates.slice(0, 8),
      },
      null,
      2,
    ),
  );

  if (args.dryRun || updates.length === 0) return;

  let ok = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from("directory_manual")
      .update({ name: u.after })
      .eq("id", u.id);
    if (error) {
      console.error("Update failed", u.id, u.before, "→", u.after, error.message);
      continue;
    }
    ok += 1;
  }
  console.log(JSON.stringify({ updated: ok, failed: updates.length - ok }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
