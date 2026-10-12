import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPrivateAreaPath } from "../../lib/analytics-scope";

/**
 * Pages whose URL can carry patient data or sign-in tokens (user, 2026-10-12): the doctor's
 * internal area. Google's tag and Vercel's analytics send the full URL, so they stay off there.
 */
describe("isPrivateAreaPath", () => {
  it("covers the doctor's internal pages", () => {
    for (const path of [
      "/dashboard",
      "/dashboard/",
      "/agenda",
      "/agenda/visits",
      "/agenda/visits/",
      "/agenda/settings",
      "/settings",
      "/settings/",
      "/agenda/insights",
      "/dashboard/appointments/abc",
    ]) {
      assert.equal(isPrivateAreaPath(path), true, path);
    }
  });

  it("covers the emailed sign-in link and the founders' internal area", () => {
    assert.equal(isPrivateAreaPath("/auth/sign-in-link"), true);
    assert.equal(isPrivateAreaPath("/internal"), true);
    assert.equal(isPrivateAreaPath("/internal/dashboard"), true);
  });

  it("leaves the public site alone", () => {
    for (const path of ["/", "/en", "/for-professionals", "/login", "/blog/post", "/clinics", "/dashboardx", "/agendas", "/internalx", "/some-doctor"]) {
      assert.equal(isPrivateAreaPath(path), false, path);
    }
  });

  it("is false for no path", () => {
    assert.equal(isPrivateAreaPath(null), false);
    assert.equal(isPrivateAreaPath(undefined), false);
  });
});
