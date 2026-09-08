import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withTimeout } from "@/lib/promise-timeout";

describe("withTimeout", () => {
  it("returns the resolved value when it finishes in time", async () => {
    const value = await withTimeout(Promise.resolve(7), 100, "fast");
    assert.equal(value, 7);
  });

  it("rejects when the promise does not settle", async () => {
    await assert.rejects(
      withTimeout(new Promise(() => undefined), 20, "hanging call"),
      /hanging call timed out after 20ms/,
    );
  });
});
