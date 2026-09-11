import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  e2eRegisterHooksEnabled,
  matchesAutomatedDoctorRegistrationTestEmailForAdminBypass,
} from "@/lib/e2e-doctor-registration-test";
import { TAG_LOCAL_REGISTER, TAG_PR_E2E } from "../helpers/ciTags";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("e2e doctor registration helpers", () => {
  it("does not treat the live register gmail alias as the admin-create bypass", () => {
    assert.equal(
      matchesAutomatedDoctorRegistrationTestEmailForAdminBypass(
        "rociosirvent+rege2e1770000000000@gmail.com",
      ),
      false,
    );
  });

  it("enables clinic hooks only when the public flag is 1", () => {
    const previous = process.env.NEXT_PUBLIC_DOC_CY_E2E_REGISTER_HOOKS;
    delete process.env.NEXT_PUBLIC_DOC_CY_E2E_REGISTER_HOOKS;
    assert.equal(e2eRegisterHooksEnabled(), false);
    process.env.NEXT_PUBLIC_DOC_CY_E2E_REGISTER_HOOKS = "1";
    assert.equal(e2eRegisterHooksEnabled(), true);
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_DOC_CY_E2E_REGISTER_HOOKS;
    } else {
      process.env.NEXT_PUBLIC_DOC_CY_E2E_REGISTER_HOOKS = previous;
    }
  });

  it("keeps the live register specs off the PR Playwright grep", () => {
    const specs = [
      "tests/integration/doctor_register_flow.integration.spec.ts",
      "tests/integration/doctor_register_claim_flow.integration.spec.ts",
    ];
    for (const relative of specs) {
      const spec = fs.readFileSync(path.join(repoRoot, relative), "utf8");
      assert.equal(spec.includes(`tag: "${TAG_LOCAL_REGISTER}"`), true, relative);
      assert.equal(spec.includes(TAG_PR_E2E), false, relative);
    }
  });
});
