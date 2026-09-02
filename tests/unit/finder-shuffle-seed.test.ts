import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFinderManualShuffleSeed,
  isFinderShuffleSeed,
  readFinderShuffleSeed,
  resolveFinderShuffleSeed,
} from "@/lib/finder-shuffle-seed";

describe("finder shuffle session seed", () => {
  it("accepts a UUID cookie and mints a new one when missing", () => {
    const existing = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    assert.equal(isFinderShuffleSeed(existing), true);
    assert.equal(readFinderShuffleSeed(existing), existing);
    assert.deepEqual(resolveFinderShuffleSeed(existing), {
      seed: existing,
      persist: false,
    });

    const minted = resolveFinderShuffleSeed("");
    assert.equal(minted.persist, true);
    assert.equal(isFinderShuffleSeed(minted.seed), true);
    assert.notEqual(minted.seed, existing);
  });

  it("scopes the shuffle seed to the current finder list", () => {
    const session = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    assert.equal(
      buildFinderManualShuffleSeed("/limassol/dentistry", session),
      `${session}|/limassol/dentistry`,
    );
  });
});
