import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertLocalDbUrl,
  parseAppliedVersions,
  pendingMigrations,
  publicTablesOutside,
  snapshotFreshness,
} from "../../scripts/ci-db/load-lib.mjs";

describe("ci-db snapshotFreshness", () => {
  const files = [
    "20260926073215_request_log_and_types.sql",
    "20260927074306_appointments_location.sql",
    "20261001090000_future_change.sql",
    ".gitkeep",
  ];

  it("is fresh when the snapshot has every repo migration", () => {
    const applied = new Set(["20260926073215", "20260927074306", "20261001090000"]);
    assert.deepEqual(snapshotFreshness(files, applied, 10), {
      pending: [],
      snapshotOnly: [],
      stale: false,
    });
  });

  it("lists repo migrations the snapshot lacks, and stays fresh up to the limit", () => {
    const applied = new Set(["20260926073215"]);
    const result = snapshotFreshness(files, applied, 2);
    assert.deepEqual(result.pending, ["20260927074306", "20261001090000"]);
    assert.equal(result.stale, false);
  });

  it("is stale once more migrations than the limit are pending", () => {
    const applied = new Set(["20260926073215"]);
    assert.equal(snapshotFreshness(files, applied, 1).stale, true);
  });

  it("lists versions applied in Testing that the repo does not have (unmerged work)", () => {
    const applied = new Set(["20260926073215", "20260927074306", "20261001090000", "20260927140604"]);
    const result = snapshotFreshness(files, applied, 10);
    assert.deepEqual(result.snapshotOnly, ["20260927140604"]);
    assert.equal(result.stale, false);
  });
});

describe("ci-db publicTablesOutside", () => {
  const schemaSql = [
    'CREATE TABLE IF NOT EXISTS "public"."professionals" (',
    '    "id" "uuid" NOT NULL',
    ");",
    'CREATE TABLE IF NOT EXISTS "public"."specialties" (',
    ");",
    'CREATE TABLE IF NOT EXISTS "public"."app_settings" (',
    ");",
    'CREATE TABLE IF NOT EXISTS "auth"."users" (',
    ");",
    "CREATE TABLE public.request_drafts (",
    ");",
  ].join("\n");

  it("lists every public table that is not allowlisted, so new tables stay out", () => {
    assert.deepEqual(publicTablesOutside(schemaSql, ["specialties", "app_settings"]), [
      "public.professionals",
      "public.request_drafts",
    ]);
  });

  it("ignores tables in other schemas", () => {
    assert.ok(!publicTablesOutside(schemaSql, []).includes("auth.users"));
  });

  it("throws when an allowlisted table is missing from the schema", () => {
    assert.throws(() => publicTablesOutside(schemaSql, ["specialties", "request_types"]), /request_types/);
  });
});

describe("ci-db assertLocalDbUrl", () => {
  it("accepts the local Supabase stack", () => {
    assert.doesNotThrow(() => assertLocalDbUrl("http://127.0.0.1:54321"));
    assert.doesNotThrow(() => assertLocalDbUrl("http://localhost:54321"));
    assert.doesNotThrow(() => assertLocalDbUrl("postgresql://postgres:postgres@127.0.0.1:54322/postgres"));
    assert.doesNotThrow(() => assertLocalDbUrl("http://[::1]:54321"));
  });

  it("refuses hosted Supabase projects", () => {
    assert.throws(() => assertLocalDbUrl("https://fwinchqdgrkpxuuttech.supabase.co"), /not a local/i);
    assert.throws(() => assertLocalDbUrl("https://oiwlztcduxojadbcxkil.supabase.co"), /not a local/i);
  });

  it("refuses hosts that only look local", () => {
    assert.throws(() => assertLocalDbUrl("http://127.0.0.1.evil.example:54321"), /not a local/i);
    assert.throws(() => assertLocalDbUrl("http://localhost.supabase.co"), /not a local/i);
  });

  it("refuses empty or malformed URLs", () => {
    assert.throws(() => assertLocalDbUrl(""), /not a local/i);
    assert.throws(() => assertLocalDbUrl(undefined), /not a local/i);
    assert.throws(() => assertLocalDbUrl("not a url"), /not a local/i);
  });
});

describe("ci-db parseAppliedVersions", () => {
  it("reads one version per line, ignoring comments and blank lines", () => {
    const text = "# applied in Testing when the snapshot was taken\n20260422214449\n\n20260927140604\r\n";
    assert.deepEqual([...parseAppliedVersions(text)].sort(), ["20260422214449", "20260927140604"]);
  });

  it("rejects a line that is not a 14-digit version", () => {
    assert.throws(() => parseAppliedVersions("20260422214449\n2026-09-27\n"), /line 2/);
  });

  it("rejects an empty list", () => {
    assert.throws(() => parseAppliedVersions("# nothing\n"), /no versions/i);
  });
});

describe("ci-db pendingMigrations", () => {
  const files = [
    "20260926073215_request_log_and_types.sql",
    "20260422214449_doctors_avatar_url.sql",
    "20260927074306_appointments_location_references_professional_clinics.sql",
    "20261001090000_future_change.sql",
    ".gitkeep",
    "README.md",
    "20261002_bad_name.sql",
  ];

  it("returns repo migrations the snapshot has not applied, oldest first", () => {
    const applied = new Set(["20260422214449", "20260926073215"]);
    assert.deepEqual(pendingMigrations(files, applied), [
      "20260927074306_appointments_location_references_professional_clinics.sql",
      "20261001090000_future_change.sql",
    ]);
  });

  it("includes an older migration merged after the snapshot was taken", () => {
    const applied = new Set(["20260926073215", "20260927074306", "20261001090000"]);
    assert.deepEqual(pendingMigrations(files, applied), ["20260422214449_doctors_avatar_url.sql"]);
  });

  it("does not re-apply a version the snapshot already has, even when newer than the repo's", () => {
    const applied = new Set([
      "20260422214449",
      "20260926073215",
      "20260927074306",
      "20261001090000",
      "20261005000000",
    ]);
    assert.deepEqual(pendingMigrations(files, applied), []);
  });

  it("ignores files that are not timestamped migrations", () => {
    const result = pendingMigrations(files, new Set(["20000101000000"]));
    assert.equal(result.length, 4);
    assert.ok(result.every((name) => /^\d{14}_.+\.sql$/.test(name)));
  });
});
