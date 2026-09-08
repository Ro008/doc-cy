import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { needsSupabaseSessionMiddleware, shouldSkipSupabaseSessionRefresh } from "@/lib/needs-supabase-session-middleware";

describe("needsSupabaseSessionMiddleware", () => {
  it("skips Auth on public patient pages", () => {
    for (const path of [
      "/",
      "/clinics",
      "/clinics/paphos",
      "/larnaca",
      "/larnaca/dentistry",
      "/all/gynecology",
      "/finder/professional/maria",
      "/blog",
      "/blog/some-post",
      "/for-professionals",
      "/terms",
      "/privacy",
      "/andreas-nikos",
      "/en/andreas-nikos",
      "/internal",
      "/internal/directory",
    ]) {
      assert.equal(needsSupabaseSessionMiddleware(path), false, path);
    }
    assert.equal(needsSupabaseSessionMiddleware("/auth/callback"), false);
  });

  it("refreshes Auth on doctor product routes", () => {
    for (const path of [
      "/agenda",
      "/agenda/settings",
      "/agenda/insights",
      "/dashboard",
      "/dashboard/appointments/abc",
      "/login",
      "/login/",
      "/register",
      "/forgot-password",
      "/forgot-password/",
      "/reset-password",
      "/reset-password/",
    ]) {
      assert.equal(needsSupabaseSessionMiddleware(path), true, path);
    }
  });

  it("skips Auth refresh on register POST (server action) but not GET", () => {
    assert.equal(shouldSkipSupabaseSessionRefresh("/register", "POST"), true);
    assert.equal(shouldSkipSupabaseSessionRefresh("/register", "GET"), false);
    assert.equal(shouldSkipSupabaseSessionRefresh("/register?error=auth", "POST"), true);
    assert.equal(shouldSkipSupabaseSessionRefresh("/agenda", "POST"), false);
  });
});
