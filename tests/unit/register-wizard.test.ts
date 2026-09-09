import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("register wizard wiring", () => {
  it("uses the 3-step wizard with first and last name fields", () => {
    const source = fs.readFileSync(path.join(repoRoot, "app/register/page.tsx"), "utf8");
    assert.match(source, /RegisterWizard/);
    assert.match(source, /name="firstName"/);
    assert.match(source, /name="lastName"/);
    assert.doesNotMatch(source, /name="fullName"/);
  });
});
