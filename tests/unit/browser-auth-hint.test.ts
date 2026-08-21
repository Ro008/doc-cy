import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasBrowserAuthHint } from "@/lib/browser-auth-hint";

describe("hasBrowserAuthHint", () => {
  it("is false in Node (no window / document cookies)", () => {
    assert.equal(hasBrowserAuthHint(), false);
  });
});
