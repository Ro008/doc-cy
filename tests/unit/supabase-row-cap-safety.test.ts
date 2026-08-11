import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Regression guard: PostgREST max-rows (~1000) is NOT raised by `.limit(5000+)`.
 * Prefer `fetchAllSupabaseRows` / `fetchAllSupabaseRowsForIdChunks`.
 * See `.cursor/rules/supabase-row-cap-safety.mdc`.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const SCAN_DIRS = ["app", "lib", "scripts"];
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

/** Limits that look like “please return more than the server max” — always wrong. */
const FAKE_HIGH_LIMIT_RE = /\.limit\(\s*(?:5000|10000|12000)\s*\)/g;

/**
 * Building one PostgREST `id.in.(${ids.join(",")})` (often inside `.or(...)`)
 * with thousands of UUIDs blows the request (Limassol finder incident, 2026-08).
 * Chunk via `fetchAllSupabaseRowsForIdChunks` / `.in("id", chunk)` instead.
 */
const HUGE_IN_JOIN_RE = /id\.in\.\(\$\{[^;\n]*\.join\(/g;

function listCodeFiles(dir: string): string[] {
  const abs = path.join(repoRoot, dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  const stack = [abs];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const name of fs.readdirSync(cur)) {
      if (name === "node_modules" || name === ".next" || name === "dist") continue;
      const full = path.join(cur, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (CODE_EXT.has(path.extname(name))) out.push(full);
    }
  }
  return out;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("supabase row-cap anti-patterns", () => {
  it("does not use fake high .limit(5000|10000|12000) in app/lib/scripts", () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of listCodeFiles(dir)) {
        const text = stripComments(fs.readFileSync(file, "utf8"));
        FAKE_HIGH_LIMIT_RE.lastIndex = 0;
        if (!FAKE_HIGH_LIMIT_RE.test(text)) continue;
        FAKE_HIGH_LIMIT_RE.lastIndex = 0;
        const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
        offenders.push(rel);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Fake high .limit() does not bypass PostgREST max-rows (~1000). ` +
        `Use fetchAllSupabaseRows instead. Offenders:\n${offenders.join("\n")}`,
    );
  });

  it("does not build a single id.in.(${...join(...)}) for large UUID lists", () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of listCodeFiles(dir)) {
        const text = stripComments(fs.readFileSync(file, "utf8"));
        HUGE_IN_JOIN_RE.lastIndex = 0;
        if (!HUGE_IN_JOIN_RE.test(text)) continue;
        HUGE_IN_JOIN_RE.lastIndex = 0;
        const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
        offenders.push(rel);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Do not interpolate large UUID lists into id.in.(...). ` +
        `Use fetchAllSupabaseRowsForIdChunks (see Limassol finder incident). ` +
        `Offenders:\n${offenders.join("\n")}`,
    );
  });
});
