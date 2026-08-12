import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DIRECTORY_CANARIES,
  isDirectoryCanaryId,
  isDirectoryCanaryPhone,
  isDirectoryCanarySlug,
} from "@/lib/directory-canaries";

describe("directory canaries", () => {
  it("registers six honeytoken profiles with unique phones", () => {
    assert.equal(DIRECTORY_CANARIES.length, 6);
    const phones = new Set(DIRECTORY_CANARIES.map((row) => row.phone));
    assert.equal(phones.size, 6);
    for (const row of DIRECTORY_CANARIES) {
      assert.match(row.phone, /^\+3579904180[1-6]$/);
      assert.ok(isDirectoryCanarySlug(row.slug));
      assert.ok(isDirectoryCanaryPhone(row.phone));
      assert.ok(isDirectoryCanaryId(row.id));
    }
  });

  it("rejects non-canary values", () => {
    assert.equal(isDirectoryCanarySlug("andreas-pallouras"), false);
    assert.equal(isDirectoryCanaryPhone("+35799111222"), false);
    assert.equal(isDirectoryCanaryId("00000000-0000-0000-0000-000000000000"), false);
  });
});
