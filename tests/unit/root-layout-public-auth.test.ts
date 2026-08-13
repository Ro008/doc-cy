import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("root layout does not block public HTML", () => {
  it("does not call Auth, cookies(), headers(), or getMessages() in app/layout.tsx", () => {
    const source = fs.readFileSync(path.join(repoRoot, "app/layout.tsx"), "utf8");
    assert.equal(source.includes("createServerComponentClient"), false);
    assert.equal(source.includes("getUser("), false);
    assert.equal(source.includes("getMessages"), false);
    assert.equal(source.includes("NextIntlClientProvider"), false);
    assert.equal(source.includes("next/headers"), false);
  });

  it("only refreshes Supabase session when needsSupabaseSessionMiddleware is true", () => {
    const source = fs.readFileSync(path.join(repoRoot, "middleware.ts"), "utf8");
    assert.equal(source.includes("needsSupabaseSessionMiddleware"), true);
    assert.equal(source.includes("await supabase.auth.getSession()"), true);
    const sessionCallIndex = source.indexOf("await supabase.auth.getSession()");
    const gateIndex = source.lastIndexOf("needsSupabaseSessionMiddleware(pathname)", sessionCallIndex);
    assert.ok(gateIndex >= 0 && gateIndex < sessionCallIndex);
  });

  it("does not Set-Cookie on the HTML middleware response", () => {
    const source = fs.readFileSync(path.join(repoRoot, "middleware.ts"), "utf8");
    assert.equal(source.includes("res.cookies.set"), false);
  });
});
