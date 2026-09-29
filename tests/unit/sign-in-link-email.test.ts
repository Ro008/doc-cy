import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSignInLinkEmailContent } from "../../lib/send-sign-in-link-email";

/** The email with her sign-in link and code (English only for now; user, 2026-09-29). */
describe("buildSignInLinkEmailContent", () => {
  const content = buildSignInLinkEmailContent({
    signInUrl: "https://www.mydoccy.com/auth/sign-in-link?token_hash=abc&next=%2Fagenda",
    code: "12345678",
  });

  it("has a plain subject", () => {
    assert.equal(content.subject, "[DocCy] Your sign-in link");
  });

  it("carries the link and the code in both parts", () => {
    for (const part of [content.text, content.html]) {
      assert.match(part, /token_hash=abc/);
      assert.match(part, /12345678/);
    }
  });

  it("says it lasts one hour and works once", () => {
    for (const part of [content.text, content.html]) {
      assert.match(part, /1 hour/);
      assert.match(part, /once/);
    }
  });

  it("tells her what to do if she didn't try to sign in", () => {
    assert.match(content.text, /didn't try to sign in/i);
    assert.match(content.text, /change your password/i);
  });

  it("escapes the link in the HTML", () => {
    const risky = buildSignInLinkEmailContent({
      signInUrl: 'https://x.test/a?b="c"&d=<e>',
      code: "123456",
    });
    assert.doesNotMatch(risky.html, /<e>/);
  });
});
