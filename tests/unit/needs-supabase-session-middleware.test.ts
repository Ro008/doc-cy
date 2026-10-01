import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isProfessionalGatedPath,
  needsSupabaseSessionMiddleware,
  shouldSkipSupabaseSessionRefresh,
} from "@/lib/needs-supabase-session-middleware";

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
      "/internalx",
      "/settingsx",
    ]) {
      assert.equal(needsSupabaseSessionMiddleware(path), false, path);
    }
    assert.equal(needsSupabaseSessionMiddleware("/auth/callback"), false);
    assert.equal(needsSupabaseSessionMiddleware("/auth/confirm-email"), false);
  });

  it("refreshes Auth on doctor product routes", () => {
    for (const path of [
      "/agenda",
      "/agenda/settings",
      "/agenda/insights",
      "/settings",
      "/settings/",
      "/dashboard",
      "/dashboard/appointments/abc",
      "/login",
      "/login/",
      "/register",
      "/forgot-password",
      "/forgot-password/",
      "/reset-password",
      "/reset-password/",
      // Admin pages: the middleware keeps the admin's session cookie fresh.
      "/internal",
      "/internal/sign-in",
      "/internal/directory",
      "/internal/directory/",
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

describe("isProfessionalGatedPath", () => {
  it("gates the agenda and settings (signed-in, verified professionals)", () => {
    for (const path of ["/agenda", "/agenda/insights", "/agenda/settings", "/settings", "/settings/"]) {
      assert.equal(isProfessionalGatedPath(path), true, path);
    }
  });

  it("leaves other routes to their own checks", () => {
    for (const path of ["/", "/settingsx", "/login", "/dashboard", "/andreas-nikos"]) {
      assert.equal(isProfessionalGatedPath(path), false, path);
    }
  });
});
