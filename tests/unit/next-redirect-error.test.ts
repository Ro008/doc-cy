import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isNextRedirectError } from "@/lib/next-redirect-error";

describe("isNextRedirectError", () => {
  it("detects Next.js redirect digest", () => {
    assert.equal(isNextRedirectError({ digest: "NEXT_REDIRECT;replace;/register?submitted=1" }), true);
  });

  it("rejects ordinary errors", () => {
    assert.equal(isNextRedirectError(new Error("Auth sign-up timed out after 20000ms")), false);
    assert.equal(isNextRedirectError(null), false);
  });
});
