import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { loadProfileHeadline, setProfessionalHeadline } from "../../lib/profile-headline-server";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

/**
 * The headline's backend (user, 2026-10-13): every change goes through
 * professional_headline_set, which records it in request_log with no founder and
 * refuses a 6th change in a rolling 30 days (supabase/tests/professional_headline_change.test.sql).
 */
type Call = { fn: string; args: unknown };

function fakeService(answer: { data?: unknown; error?: unknown }, calls: Call[] = []) {
  return {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return { data: answer.data ?? null, error: answer.error ?? null };
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: answer.data ?? null, error: answer.error ?? null }) }) }),
    }),
  } as never;
}

describe("setProfessionalHeadline", () => {
  it("calls the database function with her id and the headline", async () => {
    const calls: Call[] = [];
    const result = await setProfessionalHeadline(fakeService({ data: "request-id" }, calls), {
      professionalId: "pro-1",
      headline: "Gentle dentistry",
    });
    assert.deepEqual(result, { ok: true, changed: true });
    assert.deepEqual(calls, [
      { fn: "professional_headline_set", args: { p_professional_id: "pro-1", p_headline: "Gentle dentistry" } },
    ]);
  });

  it("says nothing changed when the database recorded nothing", async () => {
    assert.deepEqual(
      await setProfessionalHeadline(fakeService({ data: null }), { professionalId: "pro-1", headline: null }),
      { ok: true, changed: false },
    );
  });

  it("answers 429 with when she can change it again, when over 5 in 30 days", async () => {
    const result = await setProfessionalHeadline(
      fakeService({ error: { code: "DC429", details: "2026-11-01T10:00:00Z", hint: "window" } }),
      { professionalId: "pro-1", headline: "Sixth" },
    );
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 429);
    assert.match(result.ok === false ? result.message : "", /reached the limit[\s\S]*01\/11\/2026/);
  });

  it("answers 400 for what the database refuses as invalid, 500 otherwise", async () => {
    const invalid = await setProfessionalHeadline(fakeService({ error: { code: "22023" } }), {
      professionalId: "pro-1",
      headline: "x",
    });
    assert.equal(invalid.ok === false && invalid.status, 400);
    const broken = await setProfessionalHeadline(fakeService({ error: { code: "XX000" } }), {
      professionalId: "pro-1",
      headline: "x",
    });
    assert.equal(broken.ok === false && broken.status, 500);
  });
});

describe("loadProfileHeadline", () => {
  it("returns her headline, on one line", async () => {
    assert.equal(await loadProfileHeadline(fakeService({ data: { profile_headline: "  Kind  care " } }), "pro-1"), "Kind care");
  });

  it("is no headline when she has none, or when the column is not there yet", async () => {
    assert.equal(await loadProfileHeadline(fakeService({ data: { profile_headline: null } }), "pro-1"), null);
    assert.equal(await loadProfileHeadline(fakeService({ data: null }), "pro-1"), null);
    // Production before the migration: the page still opens, without a headline.
    assert.equal(await loadProfileHeadline(fakeService({ error: { code: "42703", message: "no column" } }), "pro-1"), null);
  });
});

describe("PATCH /api/professional-profile-customization", () => {
  const route = read("app/api/professional-profile-customization/route.ts");

  it("is for the signed-in professional, on her own row", () => {
    assert.match(route, /export async function PATCH\(/);
    assert.match(route, /supabase\.auth\.getUser\(\)/);
    assert.match(route, /status: 401/);
    assert.match(route, /\.eq\("auth_user_id", user\.id\)/);
    assert.match(route, /status: 403/);
  });

  it("checks the headline before the database, and writes only through the recorded function", () => {
    assert.match(route, /profileHeadlineError\(/);
    assert.match(route, /status: 400/);
    assert.match(route, /setProfessionalHeadline\(/);
    assert.doesNotMatch(route, /\.update\(/);
    assert.doesNotMatch(route, /accent/);
  });

  it("the pages read the headline with the tolerant loader", () => {
    assert.match(read("lib/public/doctor-profile-page.tsx"), /loadProfileHeadline\(supabase, profile\.id\)/);
    assert.match(read("app/settings/page.tsx"), /loadProfileHeadline\(/);
  });
});
