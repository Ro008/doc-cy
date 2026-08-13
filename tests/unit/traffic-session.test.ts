import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TRAFFIC_SESSION_COOKIE,
  TRAFFIC_SESSION_JS_COOKIE,
  trafficSessionIdFromCookieStore,
  trafficSessionPersistInlineScript,
} from "@/lib/traffic-log";

function cookieStore(map: Record<string, string>) {
  return {
    get(name: string) {
      const value = map[name];
      return value ? { value } : undefined;
    },
  };
}

describe("traffic session cookies", () => {
  it("prefers the legacy httpOnly cookie when both exist", () => {
    assert.equal(
      trafficSessionIdFromCookieStore(
        cookieStore({
          [TRAFFIC_SESSION_COOKIE]: "legacy-id",
          [TRAFFIC_SESSION_JS_COOKIE]: "js-id",
        }),
      ),
      "legacy-id",
    );
  });

  it("falls back to the JS cookie", () => {
    assert.equal(
      trafficSessionIdFromCookieStore(cookieStore({ [TRAFFIC_SESSION_JS_COOKIE]: "js-id" })),
      "js-id",
    );
  });

  it("returns null when neither cookie is present", () => {
    assert.equal(trafficSessionIdFromCookieStore(cookieStore({})), null);
  });

  it("persists the JS cookie name in an inline script without Set-Cookie", () => {
    const script = trafficSessionPersistInlineScript();
    assert.equal(script.includes(TRAFFIC_SESSION_JS_COOKIE), true);
    assert.equal(script.includes("Set-Cookie"), false);
    assert.equal(script.includes("document.cookie"), true);
  });
});
