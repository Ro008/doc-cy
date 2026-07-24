/**
 * One-off: restore prod Dermatology rows that have Maps/coords from testing.
 * Keyed by ghs_code. Explicit prod write — only run when user requests.
 *
 * Usage:
 *   DOC_CY_CONFIRM_PROD=YES node scripts/restore-prod-dermatology-from-testing.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

function loadEnv(filePath) {
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      }),
  );
}

async function fetchAllDermatology(sb) {
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from("directory_manual")
      .select(
        "name, specialty, district, address_maps_link, phone, latitude, longitude, slug, ghs_code, email, gender, address, is_gesy, is_archived",
      )
      .eq("specialty", "Dermatology")
      .eq("is_archived", false)
      .not("ghs_code", "is", null)
      .range(from, from + 999);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return all;
}

function parseArgs(argv) {
  return {
    confirm: process.env.DOC_CY_CONFIRM_PROD === "YES" || argv.includes("--confirm-prod"),
    dryRun: argv.includes("--dry-run"),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.confirm) {
    console.error("Refusing prod write. Set DOC_CY_CONFIRM_PROD=YES or pass --confirm-prod.");
    process.exit(1);
  }

  const testingEnv = loadEnv(".env.local");
  const prodEnv = loadEnv(".env.production.local");
  const testing = createClient(
    testingEnv.NEXT_PUBLIC_SUPABASE_URL,
    testingEnv.SUPABASE_SERVICE_ROLE_KEY,
  );
  const prod = createClient(
    prodEnv.NEXT_PUBLIC_SUPABASE_URL,
    prodEnv.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (!String(prodEnv.NEXT_PUBLIC_SUPABASE_URL || "").includes("oiwlztcduxojadbcxkil")) {
    console.error("Refusing: .env.production.local does not point at DocCy prod.");
    process.exit(1);
  }

  const testingRows = await fetchAllDermatology(testing);
  const withMaps = testingRows.filter(
    (r) => String(r.address_maps_link || "").trim().length > 0,
  );

  console.log(
    `Testing Dermatology with ghs_code: ${testingRows.length}; with Maps: ${withMaps.length}`,
  );

  const preserved = [
    "Valentina Oflidou",
    "Vera Politou",
    "Korina Tryfonos",
    "Georgina Sarika",
  ];
  for (const name of preserved) {
    const hit = withMaps.find((r) => r.name === name);
    console.log(`  preserved ${name}: ${hit ? `ghs=${hit.ghs_code}` : "MISSING IN TESTING"}`);
  }

  if (args.dryRun) {
    console.log("Dry run only — no prod writes.");
    return;
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of withMaps) {
    const ghs = String(row.ghs_code || "").trim();
    if (!ghs) {
      skipped += 1;
      continue;
    }

    const payload = {
      name: row.name,
      specialty: "Dermatology",
      district: row.district,
      address_maps_link: row.address_maps_link,
      phone: row.phone,
      latitude: row.latitude,
      longitude: row.longitude,
      slug: row.slug,
      ghs_code: ghs,
      email: row.email,
      gender: row.gender,
      address: row.address,
      is_gesy: true,
      is_archived: false,
    };

    const { data: existing, error: findErr } = await prod
      .from("directory_manual")
      .select("id")
      .eq("ghs_code", ghs)
      .eq("is_archived", false)
      .maybeSingle();
    if (findErr) throw findErr;

    if (existing?.id) {
      const { error } = await prod
        .from("directory_manual")
        .update({
          name: payload.name,
          district: payload.district,
          address_maps_link: payload.address_maps_link,
          phone: payload.phone,
          latitude: payload.latitude,
          longitude: payload.longitude,
          slug: payload.slug,
          email: payload.email,
          gender: payload.gender,
          address: payload.address,
          is_gesy: true,
        })
        .eq("id", existing.id);
      if (error) throw error;
      updated += 1;
    } else {
      const { error } = await prod.from("directory_manual").insert(payload);
      if (error) throw error;
      inserted += 1;
    }
  }

  const { count: derm } = await prod
    .from("directory_manual")
    .select("id", { count: "exact", head: true })
    .eq("specialty", "Dermatology")
    .eq("is_archived", false);
  const { count: maps } = await prod
    .from("directory_manual")
    .select("id", { count: "exact", head: true })
    .eq("specialty", "Dermatology")
    .eq("is_archived", false)
    .not("address_maps_link", "is", null);
  const { count: gesy } = await prod
    .from("directory_manual")
    .select("id", { count: "exact", head: true })
    .eq("specialty", "Dermatology")
    .eq("is_archived", false)
    .eq("is_gesy", true);

  console.log({ inserted, updated, skipped, prod_dermatology: derm, with_maps: maps, is_gesy: gesy });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
