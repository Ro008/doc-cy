import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PRO_CHROME_AGENDA_ATTR,
  PRO_CHROME_BOOT_ATTR,
  PRO_SESSION_HINT_COOKIE,
  isProSessionHintValue,
  parseProSessionHintCookie,
  proChromeBootInlineScript,
} from "@/lib/pro-session-hint";

describe("pro session hint cookie", () => {
  it("accepts the signed-in marker", () => {
    assert.equal(isProSessionHintValue("1"), true);
    assert.equal(isProSessionHintValue(" 1 "), true);
    assert.equal(isProSessionHintValue("0"), false);
    assert.equal(isProSessionHintValue(""), false);
  });

  it("parses the cookie from a header string", () => {
    assert.equal(parseProSessionHintCookie(`${PRO_SESSION_HINT_COOKIE}=1`), true);
    assert.equal(
      parseProSessionHintCookie(`other=x; ${PRO_SESSION_HINT_COOKIE}=1; theme=light`),
      true,
    );
    assert.equal(parseProSessionHintCookie(`${PRO_SESSION_HINT_COOKIE}=0`), false);
    assert.equal(parseProSessionHintCookie(""), false);
  });

  it("boot script sets the first-paint attribute from the hint cookie", () => {
    const script = proChromeBootInlineScript();
    assert.equal(script.includes(PRO_SESSION_HINT_COOKIE), true);
    assert.equal(script.includes(PRO_CHROME_BOOT_ATTR), true);
    assert.equal(script.includes(PRO_CHROME_AGENDA_ATTR), true);
    assert.equal(script.includes("/login"), true);
    assert.equal(script.includes("/forgot-password"), true);
    assert.equal(script.includes("/reset-password"), true);
    assert.equal(script.includes("Set-Cookie"), false);
    assert.equal(script.includes("document.cookie"), true);
  });

  function runBootScript(pathname: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const fakeDocument = {
      cookie: `${PRO_SESSION_HINT_COOKIE}=1`,
      documentElement: {
        setAttribute(name: string, value: string) {
          attrs[name] = value;
        },
      },
    };
    new Function("location", "document", proChromeBootInlineScript())(
      { pathname },
      fakeDocument,
    );
    return attrs;
  }

  it("boot script gives the dashboard the same sticky chrome as the agenda", () => {
    for (const path of ["/dashboard", "/agenda", "/agenda/settings", "/settings"]) {
      const attrs = runBootScript(path);
      assert.equal(attrs[PRO_CHROME_BOOT_ATTR], "1", path);
      assert.equal(attrs[PRO_CHROME_AGENDA_ATTR], "1", path);
    }
  });

  it("boot script keeps public pages and the review page without sticky chrome", () => {
    const publicAttrs = runBootScript("/for-professionals");
    assert.equal(publicAttrs[PRO_CHROME_BOOT_ATTR], "1");
    assert.equal(publicAttrs[PRO_CHROME_AGENDA_ATTR], undefined);

    assert.deepEqual(runBootScript("/dashboard/appointments/abc"), {});
  });
});
