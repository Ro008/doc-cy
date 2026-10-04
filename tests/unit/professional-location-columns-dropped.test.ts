import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { FINDER_LISTING_SELECT } from "@/lib/finder-manual-directory-load";
import { LISTING_CLINICS_SELECT } from "@/lib/listing-clinic-location";

// Point E5: a professional's location (district, town, address, map link, pin, phone,
// clinic) lives on their clinics (`professional_clinics` -> `clinics`). The copies on
// `professionals` and the unused phone settings are dropped (user, 2026-10-01).
const root = path.resolve(__dirname, "../..");

const DROPPED_PROFESSIONAL_COLUMNS = [
  "district",
  "town",
  "phone",
  "clinic_address",
  "address",
  "address_maps_link",
  "latitude",
  "longitude",
  "clinic_place_id",
  "clinic_id",
];
const DROPPED_SETTINGS_COLUMNS = ["show_phone_public", "public_phone_source"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(full);
  }
  return out;
}

function codeFiles(): string[] {
  return [
    ...["app", "lib", "components", "scripts", "tests/integration", "tests/prod"].flatMap((dir) =>
      existsSync(path.join(root, dir)) ? sourceFiles(path.join(root, dir)) : [],
    ),
    path.join(root, "middleware.ts"),
  ];
}

function rel(file: string): string {
  return path.relative(root, file).replace(/\\/g, "/");
}

function namesColumn(text: string, column: string): boolean {
  // Hyphenated words (`blank-address-${nonce}`) are slugs, not columns.
  return new RegExp(`(^|[^A-Za-z0-9_.-])${column}([^A-Za-z0-9_-]|$)`).test(text);
}

/**
 * Each `.from("professionals")` call up to the end of its statement (or the next
 * `.from(`), and each `professionals(...)` embed in a select string.
 */
function professionalsQueries(src: string): string[] {
  const out: string[] = [];
  const call = /\.from\(\s*["'`]professionals["'`]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = call.exec(src))) {
    const rest = src.slice(m.index + m[0].length, m.index + m[0].length + 1500);
    const stop = rest.search(/;|\.from\(/);
    const statement = stop >= 0 ? rest.slice(0, stop) : rest;
    out.push(statement);
    // A select list kept in a variable: `.select(doctorSelect)` -> `const doctorSelect = "..."`.
    for (const sel of statement.matchAll(/\.select\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g)) {
      const def = new RegExp(
        String.raw`\b(?:const|let)\s+${sel[1]}\s*(?::[^=]+)?=\s*(["'` + "`" + String.raw`])([\s\S]*?)\1`,
      ).exec(src);
      if (def) out.push(def[2] ?? "");
    }
  }
  const embed = /\bprofessionals(?:![a-z_]+)?\s*\(([^)]*)\)/g;
  while ((m = embed.exec(src))) out.push(m[1] ?? "");
  return out;
}

describe("nothing reads or writes the dropped location columns (Point E5)", () => {
  it("queries on professionals name none of them", () => {
    const offenders: string[] = [];
    for (const file of codeFiles()) {
      const src = readFileSync(file, "utf8");
      for (const query of professionalsQueries(src)) {
        // Nested clinic embeds legitimately select the clinic's own columns, and
        // `district: ""` switches a finder filter off.
        const own = query
          .replace(/clinics(?:!inner)?\s*\([^)]*\)?/g, "")
          .replace(/\b[a-z_]+:\s*""/g, "");
        for (const column of DROPPED_PROFESSIONAL_COLUMNS) {
          if (namesColumn(own, column)) offenders.push(`${rel(file)}: ${column}`);
        }
      }
    }
    assert.deepEqual([...new Set(offenders)], []);
  });

  it("nothing names the dropped phone settings", () => {
    const offenders = codeFiles().flatMap((file) => {
      const src = readFileSync(file, "utf8");
      return DROPPED_SETTINGS_COLUMNS.filter((c) => src.includes(c)).map((c) => `${rel(file)}: ${c}`);
    });
    assert.deepEqual(offenders, []);
  });

  it("the finder and listing page select the clinics, not the copies", () => {
    assert.equal(
      FINDER_LISTING_SELECT,
      `id, slug, name, is_gesy, gender, ${LISTING_CLINICS_SELECT}`,
    );
    const landing = readFileSync(path.join(root, "lib/load-manual-directory-by-slug.ts"), "utf8");
    assert.ok(landing.includes("LISTING_CLINICS_SELECT"));
  });

  it("the importer stops writing them", () => {
    const importer = readFileSync(path.join(root, "scripts/import-gesy-directory-batch.mjs"), "utf8");
    const start = importer.indexOf("const payload = {");
    assert.ok(start > 0, "importer payload not found");
    const payload = importer.slice(start, importer.indexOf("};", start));
    for (const column of DROPPED_PROFESSIONAL_COLUMNS) {
      assert.ok(!namesColumn(payload, column), `importer payload still writes ${column}`);
    }
  });

  it("seeds and CI fixtures insert none of them", () => {
    for (const file of [
      "supabase/ci/seed.sql",
      "supabase/ci/fixtures.sql",
      "supabase/integration_seed_doccy_testing.sql",
      "supabase/integration_restore_manual_test_doctors.sql",
    ]) {
      const sql = readFileSync(path.join(root, file), "utf8");
      const inserts = sql.match(/insert\s+into\s+(?:public\.)?professionals\s*\(([^)]*)\)/gi) ?? [];
      for (const insert of inserts) {
        for (const column of DROPPED_PROFESSIONAL_COLUMNS) {
          assert.ok(!namesColumn(insert, column), `${file} inserts professionals.${column}`);
        }
      }
    }
  });

  it("removes the code that only existed for them", () => {
    assert.equal(existsSync(path.join(root, "lib/finder-manual-photos.ts")), false);
    assert.equal(existsSync(path.join(root, "scripts/backfill-doctor-towns.mjs")), false);
    const users = codeFiles().filter((file) =>
      readFileSync(file, "utf8").includes("finder-manual-photos"),
    );
    assert.deepEqual(users.map(rel), []);
  });
});

describe("patients see the appointment's clinic phone (Point E5)", () => {
  it("every booking email, calendar file and success page reads it", () => {
    // (app/api/appointments/route.ts emails the professional, with no phone.)
    for (const file of [
      "app/api/appointments/manual/route.ts",
      "app/api/appointments/[id]/confirm/route.ts",
      "app/api/appointments/[id]/calendar/route.ts",
      "app/api/booking/choose/route.ts",
      "lib/public/booking-success-page.tsx",
    ]) {
      const src = readFileSync(path.join(root, file), "utf8");
      assert.ok(src.includes("loadAppointmentClinicPhone("), `${file} does not use the clinic phone`);
      assert.ok(!/doctor(Row)?\??\.phone\b/.test(src), `${file} still reads the professional's phone`);
    }
  });
});
