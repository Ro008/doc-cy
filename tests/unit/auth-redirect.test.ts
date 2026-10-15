import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { safeAuthNextPath, withFragment } from "../../lib/auth-redirect";

describe("safeAuthNextPath", () => {
  it("accepts an internal path, with or without a #fragment", () => {
    assert.equal(safeAuthNextPath("/help"), "/help");
    assert.equal(safeAuthNextPath("/help#dashboard"), "/help#dashboard");
  });

  it("blocks anything that could leave the site", () => {
    for (const raw of ["", null, undefined, "help", "//evil.test", "https://evil.test", "/a\\b", "/x://y"]) {
      assert.equal(safeAuthNextPath(raw), null, String(raw));
    }
  });
});

// A fragment is not sent to the server, so when a signed-out professional opens /help#dashboard
// the login page has to carry it to wherever she lands after signing in.
describe("withFragment", () => {
  it("adds the page's #fragment to the path she was heading for", () => {
    assert.equal(withFragment("/help", "#dashboard"), "/help#dashboard");
    assert.equal(withFragment("/help", "#getting-started"), "/help#getting-started");
  });

  it("leaves the path alone when there is no fragment", () => {
    assert.equal(withFragment("/help", ""), "/help");
    assert.equal(withFragment("/help", "#"), "/help");
    assert.equal(withFragment("/help", null), "/help");
    assert.equal(withFragment("/help", undefined), "/help");
  });

  it("leaves a missing destination missing: nothing to attach it to", () => {
    assert.equal(withFragment(null, "#dashboard"), null);
    assert.equal(withFragment(undefined, "#dashboard"), null);
    assert.equal(withFragment("", "#dashboard"), null);
  });

  it("keeps a fragment the path already has", () => {
    assert.equal(withFragment("/help#plan", "#dashboard"), "/help#plan");
  });

  it("only takes a plain anchor: letters, digits, dot, underscore, tilde, hyphen", () => {
    for (const hash of ["#a=b", "#a/b", "#a b", "#a?b", "#a#b", "#<script>", "#//evil.test", "#a\\b", "#%2F"]) {
      assert.equal(withFragment("/help", hash), "/help", hash);
    }
  });

  it("refuses an absurdly long fragment", () => {
    assert.equal(withFragment("/help", `#${"a".repeat(101)}`), "/help");
    assert.equal(withFragment("/help", `#${"a".repeat(100)}`), `/help#${"a".repeat(100)}`);
  });

  it("always gives a path safeAuthNextPath accepts", () => {
    const result = withFragment("/help", "#dashboard");
    assert.equal(safeAuthNextPath(result), result);
  });
});
