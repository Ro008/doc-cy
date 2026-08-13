import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { needsSupabaseSessionMiddleware } from "@/lib/needs-supabase-session-middleware";

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
      "/andreas-nikos",
      "/en/andreas-nikos",
      "/internal",
      "/internal/directory",
    ]) {
      assert.equal(needsSupabaseSessionMiddleware(path), false, path);
    }
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
    ]) {
      assert.equal(needsSupabaseSessionMiddleware(path), true, path);
    }
  });
});
